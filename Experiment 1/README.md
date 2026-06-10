# Experiment 1: RadFlow-Edge — CNN → GradCAM → VLM Pipeline

A 4-stage pipeline that takes a raw chest X-ray and produces a structured triage report.

---

## Stages

1. **Detector** (`core/detector.py`) — TorchXRayVision DenseNet121 scores 18 pathologies from a 224×224 grayscale crop.
2. **Localizer** (`core/localizer.py`) — GradCAM generates a heatmap and 512×512 bounding-box crop of the highest-activation region.
3. **RAG** (`core/rag.py`) — ChromaDB retrieves relevant clinical guidelines for the top finding.
4. **Analyzer** (`core/analyzer.py`) — CheXagent-8b (NVIDIA only, 4-bit quantized) generates a detailed VLM report. On Apple Silicon / CPU, Gemma 4 E2B via Ollama generates the narrative instead.

---

## Setup

See the project-root `guide.md` for full environment setup. The experiment-specific step is downloading the model weights:

```bash
cd "Experiment 1/radflow_edge"

# DenseNet121 (~27 MB, required)
python download_models.py

# + CheXagent-8b (~16 GB, NVIDIA only)
python download_models.py --full
```

Weights are written to `models/` at the project root (two levels up from here).

---

## Running standalone

The experiment is normally invoked through `backend/main.py` via the unified API. To call the pipeline directly:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "radflow_edge"))
from core.pipeline import RadFlowPipeline

pipeline = RadFlowPipeline()
result = pipeline.analyze("path/to/xray.png", patient_context="42M, cough")
print(result)
```

---

## Hardware notes

- **Resolution**: images are resized to 224×224 for the detector; GradCAM crops are 512×512.
- **Quantization**: CheXagent uses 4-bit loading via `bitsandbytes` to stay within VRAM limits on NVIDIA.
- **Apple Silicon / CPU**: CheXagent is disabled by default; Gemma 4 E2B (Ollama) generates the report narrative.
- Set `HSIL_ENABLE_EXP1_ANALYZER=1` to force-load CheXagent on non-CUDA hardware (slow).
