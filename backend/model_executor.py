"""Single-slot model execution coordinator.

The reference deployment is an 8GB unified-memory edge device: the local
LLM alone occupies most of RAM, so only ONE model may execute at any
moment. Every model invocation in the backend — torch pipelines, local
LLM text/vision/audio calls, OCR extraction, risk scoring — must run
inside ``model_slot()`` (or hold ``MODEL_SLOT`` directly).

The lock is re-entrant: a pipeline that invokes the narrative model as a
sub-stage of an already-held slot does not deadlock. Stage transitions
call ``neutralize_torch()`` / ``unload_local_llm()`` so the outgoing
model's memory is released before the next one starts.

Two language/vision runtimes coexist in the codebase — **MLX-VLM** for the
chest-X-ray radiology narrative and **Ollama** for the Gemma services
(voice, chat, agents, OCR). On 8GB they must never be resident together.
``prepare_runtime(target)`` evicts whichever runtime is NOT the target
before it runs, and is always called inside the slot lock so two requests
can't load both runtimes at once.
"""

import gc
import threading
import time
from contextlib import contextmanager
from typing import Any, Callable, Dict, Optional

import requests

MODEL_SLOT = threading.RLock()

_CURRENT: Dict[str, Any] = {"label": None, "since": None, "depth": 0}
_HISTORY_MAX = 50
_HISTORY: list = []

# Which language/vision runtime currently holds resident memory.
_RESIDENT_RUNTIME: Optional[str] = None
# The MLX module registers a free callback here to avoid a circular import.
_MLX_FREE_HOOK: Optional[Callable[[], None]] = None
_OLLAMA_EVICT: Dict[str, str] = {"base_url": "", "model": ""}


def current_model_slot() -> Dict[str, Any]:
    """Snapshot of which model (if any) holds the execution slot."""
    snap = dict(_CURRENT)
    if snap["since"] is not None:
        snap["held_for_sec"] = round(time.time() - snap["since"], 1)
    return snap


def recent_slot_history() -> list:
    return list(_HISTORY)


@contextmanager
def model_slot(label: str):
    """Acquire the global single-model execution slot.

    ``label`` names the model/stage for live telemetry so operators can
    watch the one-at-a-time scheduling on the System Status screen.
    """
    with MODEL_SLOT:
        prev_label, prev_since = _CURRENT["label"], _CURRENT["since"]
        _CURRENT["depth"] += 1
        # Only top-level acquisitions change the visible label; nested
        # stages of one logical run keep the parent's identity.
        if _CURRENT["depth"] == 1:
            _CURRENT["label"] = label
            _CURRENT["since"] = time.time()
        started = time.time()
        try:
            yield
        finally:
            _CURRENT["depth"] -= 1
            if _CURRENT["depth"] == 0:
                _HISTORY.append(
                    {
                        "model": _CURRENT["label"],
                        "started": started,
                        "duration_sec": round(time.time() - started, 2),
                    }
                )
                del _HISTORY[:-_HISTORY_MAX]
                _CURRENT["label"] = prev_label
                _CURRENT["since"] = prev_since


def neutralize_torch() -> None:
    """Release torch allocations between pipeline stages."""
    gc.collect()
    try:
        import torch

        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def unload_local_llm(base_url: str, model: str, timeout: float = 10.0) -> bool:
    """Evict the local LLM from memory (keep_alive=0) before a heavy
    non-LLM stage needs the RAM. No-op if Ollama is unreachable."""
    try:
        resp = requests.post(
            f"{base_url.rstrip('/')}/api/generate",
            json={"model": model, "keep_alive": 0},
            timeout=timeout,
        )
        return resp.ok
    except Exception:
        return False


def register_mlx_free_hook(fn: Callable[[], None]) -> None:
    """The MLX radiology module registers its model-free callback here so
    the coordinator can evict it without importing mlx (circular)."""
    global _MLX_FREE_HOOK
    _MLX_FREE_HOOK = fn


def register_ollama_target(base_url: str, model: str) -> None:
    """Record the Ollama endpoint/model so the coordinator can evict it."""
    _OLLAMA_EVICT["base_url"] = base_url
    _OLLAMA_EVICT["model"] = model


def prepare_runtime(target: str) -> None:
    """Make ``target`` ('mlx' or 'ollama') the sole resident runtime by
    evicting the other. Call inside the slot lock, before loading/running
    the target. Idempotent when the target is already resident.

    MLX and Ollama each hold multiple GB on this box; co-residency pushes
    the 8GB device straight into swap, so this is the load-bearing memory
    guarantee, not an optimization.
    """
    global _RESIDENT_RUNTIME
    # Hold the slot so the resident-runtime read/modify/write is atomic even
    # if a caller forgets to wrap this; re-entrant, so nesting is free.
    with MODEL_SLOT:
        if target == _RESIDENT_RUNTIME:
            return
        if target == "mlx":
            # Free the Ollama model before MLX allocates.
            if _OLLAMA_EVICT["base_url"] and _OLLAMA_EVICT["model"]:
                unload_local_llm(_OLLAMA_EVICT["base_url"], _OLLAMA_EVICT["model"])
        elif target == "ollama":
            # Free the MLX model before Ollama loads.
            if _MLX_FREE_HOOK is not None:
                try:
                    _MLX_FREE_HOOK()
                except Exception:
                    pass
        neutralize_torch()
        _RESIDENT_RUNTIME = target


def resident_runtime() -> Optional[str]:
    return _RESIDENT_RUNTIME


def note_runtime_freed(runtime: str) -> None:
    """Called when a runtime frees itself (e.g. MLX after generate) so the
    coordinator's view stays accurate. Synchronized on the slot."""
    global _RESIDENT_RUNTIME
    with MODEL_SLOT:
        if _RESIDENT_RUNTIME == runtime:
            _RESIDENT_RUNTIME = None


def system_under_memory_pressure(swap_used_threshold_mb: float = 2200.0) -> bool:
    """True when macOS swap usage is high enough that starting another
    model would thrash. The async job worker checks this before pulling a
    new inference job so a backlog can't drive the device into a swap
    death-spiral. Conservative: returns False if psutil is unavailable."""
    try:
        import psutil

        swap = psutil.swap_memory()
        return (swap.used / (1024 * 1024)) >= swap_used_threshold_mb
    except Exception:
        return False
