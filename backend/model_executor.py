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
"""

import gc
import threading
import time
from contextlib import contextmanager
from typing import Any, Dict, Optional

import requests

MODEL_SLOT = threading.RLock()

_CURRENT: Dict[str, Any] = {"label": None, "since": None, "depth": 0}
_HISTORY_MAX = 50
_HISTORY: list = []


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
