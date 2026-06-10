# Experiment 2: Foveal Triage Engine

Fast anomaly localisation using OpenCV contrast analysis, designed to reduce the VLM token load before passing an image to a language model.

---

## What it does

1. **Vision Hack** (`foveal_engine/vision_hack.py`) — scans the image with a sliding contrast window and crops a 512×512 "foveal" region centred on the highest-contrast anomaly. Runs in milliseconds with no model required.
2. **Hardware Router** (`foveal_engine/router.py`) — detects Apple Silicon, NVIDIA, or CPU and returns the appropriate inference backend label.
3. **D-RoVA concept** (`foveal_engine/d_rova_concept.py`) — conceptual token router that demonstrates how irrelevant visual tokens could be dropped before VLM inference.

The foveal crop reduces token count by ~80% compared to passing the full image, which matters on edge hardware with limited VRAM or slow CPU inference.

---

## Setup

No model weights required for Experiment 2. Follow the project-root `guide.md` for the Python environment, then:

```bash
# Experiment 2 shares the models/ directory with Experiment 1 for any optional VLM calls.
# Run the Experiment 1 download if you want those weights available:
cd "Experiment 1/radflow_edge"
python download_models.py
```

---

## Running standalone

```python
from foveal_engine.vision_hack import FovealCrop

cropper = FovealCrop()
crop_path = cropper.process("path/to/xray.png")
print(f"Foveal crop saved to: {crop_path}")
```

Or via the backend API (when pipeline mode includes `experiment2`):
```
POST /api/v1/foveal
Content-Type: multipart/form-data
file: <image>
```

---

## Hardware optimisation

- **Apple Silicon**: uses `mlx-vlm` if installed for native M-series VLM inference.
- **NVIDIA**: uses the standard 4-bit `transformers` path.
- **CPU**: full-precision fallback.
