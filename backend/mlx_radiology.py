"""MLX radiology VLM service — chest-X-ray narrative on Apple MLX.

The radiology vision-language model runs on **MLX** (mlx-vlm), separate
from the Ollama Gemma services (voice, chat, agents, OCR). On the 8GB
reference box the two runtimes must never be resident together, so this
module:

- loads the model lazily, behind the global execution slot;
- caps MLX memory with ``mx.set_memory_limit`` and clears the cache after
  every generation so it can't push the device into swap;
- registers a free hook with the executor so an Ollama service call can
  evict the MLX model first (and vice versa);
- applies the nightly QLoRA adapter (``models/gemma_lora_adapters``) when
  present, closing the continual-learning loop on the radiology path.

The model id is env-configurable (``HSIL_MLX_RADIOLOGY_MODEL``). Any load
or generation failure returns ``None`` so the caller falls back to the
Ollama narrative — MLX is an upgrade to the radiology path, never a hard
dependency.
"""

import os
import threading
from typing import Optional

ADAPTER_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "gemma_lora_adapters"
)

_DEFAULT_MODEL = "mlx-community/gemma-3-4b-it-4bit"
# Cap MLX so it leaves headroom for the OS + torch detector on 8GB.
_DEFAULT_MEM_LIMIT_GB = 5.0

_lock = threading.RLock()
_model = None
_processor = None
_load_failed = False


def _model_id() -> str:
    return os.getenv("HSIL_MLX_RADIOLOGY_MODEL", _DEFAULT_MODEL)


def is_enabled() -> bool:
    return os.getenv("HSIL_DISABLE_MLX_RADIOLOGY", "0") != "1"


def _apply_memory_limit() -> None:
    try:
        import mlx.core as mx

        gb = float(os.getenv("HSIL_MLX_MEM_LIMIT_GB", _DEFAULT_MEM_LIMIT_GB))
        mx.set_memory_limit(int(gb * 1024 * 1024 * 1024))
    except Exception:
        pass


def _ensure_loaded() -> bool:
    """Load the MLX VLM once. Returns False if unavailable/failed.

    The whole check runs under ``_lock`` so a concurrent ``free_model``
    (invoked by the executor when an Ollama service needs the RAM) can't
    null out ``_model`` between the fast-path check and use.
    """
    global _model, _processor, _load_failed
    if not is_enabled():
        return False
    with _lock:
        if _model is not None:
            return True
        if _load_failed:
            return False
        try:
            from mlx_vlm import load

            _apply_memory_limit()
            adapter = ADAPTER_DIR if os.path.isdir(ADAPTER_DIR) else None
            _model, _processor = load(_model_id(), adapter_path=adapter)
            # Register eviction hook so Ollama service calls can free us.
            from model_executor import register_mlx_free_hook

            register_mlx_free_hook(free_model)
            return True
        except Exception as ex:
            _load_failed = True
            _model = None
            _processor = None
            # Surface the reason rather than silently disabling MLX; the
            # radiology path falls back to Ollama from here on.
            print(f"[mlx_radiology] model load failed, falling back to Ollama: {ex}")
            return False


def free_model() -> None:
    """Release the MLX model and clear the Metal cache. Called by the
    executor before an Ollama service runs, and after generation when the
    free-after policy is enabled."""
    global _model, _processor
    with _lock:
        _model = None
        _processor = None
        try:
            import mlx.core as mx

            mx.clear_cache()
        except Exception:
            pass
        try:
            from model_executor import note_runtime_freed

            note_runtime_freed("mlx")
        except Exception:
            pass


def generate_report(
    image_path: str,
    disease: str,
    confidence: float,
    patient_context: str,
    guideline_block: str = "",
    max_tokens: int = 500,
) -> Optional[str]:
    """Generate the radiology narrative from the X-ray (crop) with the MLX
    VLM. Returns None on any failure so the caller falls back to Ollama.

    Must be called inside the execution slot; it makes MLX the resident
    runtime (evicting Ollama) before generating.
    """
    if not is_enabled():
        return None

    from model_executor import model_slot, prepare_runtime

    with model_slot(f"mlx_radiology:{_model_id()}"):
        prepare_runtime("mlx")
        if not _ensure_loaded():
            return None
        try:
            from mlx_vlm import apply_chat_template, generate

            guideline_section = (
                f"\nRELEVANT CLINICAL GUIDELINES (cite by [SOURCE-ID]):\n{guideline_block}\n"
                if guideline_block
                else ""
            )
            prompt_text = (
                "You are a radiology assistant reviewing a chest X-ray region for a frontline nurse.\n"
                f"Patient context: {patient_context or 'not provided'}\n"
                f"CNN detector finding: {disease} (confidence {confidence:.0%})\n"
                f"{guideline_section}\n"
                "Write a concise draft report using exactly these section headers:\n\n"
                "KEY FINDINGS: what is visible in the image and whether it supports the detector finding.\n"
                "DIFFERENTIAL DIAGNOSTICS: primary diagnosis plus 2-3 alternatives to consider.\n"
                "FUTURE STEPS/PRECAUTIONS: 2-4 practical next actions for a rural clinic.\n\n"
                "When you use a guideline above, cite its bracketed source id inline "
                "exactly as shown (for example [WHO-TB-NTP] or [SEPSIS-QSOFA]). "
                "Be specific and clinical. Do not invent patient history that was not provided."
            )
            config = getattr(_model, "config", None)
            formatted = apply_chat_template(_processor, config, prompt_text, num_images=1)
            result = generate(
                _model,
                _processor,
                formatted,
                image=[image_path],
                max_tokens=max_tokens,
                temperature=0.2,
                verbose=False,
            )
            text = result.text if hasattr(result, "text") else str(result)
            text = (text or "").strip()
            return text or None
        except Exception:
            return None
        finally:
            # Clear the Metal working cache after each generation; keep the
            # weights resident for the next radiology call (freed lazily by
            # the coordinator when an Ollama service needs the RAM).
            try:
                import mlx.core as mx

                mx.clear_cache()
            except Exception:
                pass
