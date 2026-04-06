# Experiment 1: RadFlow-Edge — CNN → GradCAM → VLM Pipeline

> **Status:** CLEAN & PORTABLE Ready for Hackathon ZIP transfer.

---

## 🚀 How to Setup on Your NEW PC (High Config)

Once you unzip this project on your new high-config PC, follow these exact steps:

### Step 1: Create a New Environment
Open your terminal inside the project root and run:
```bash
python -m venv .venv
source .venv/bin/activate  # (On Windows: .venv\Scripts\activate)
pip install -r requirements.txt
```

### Step 2: Download Models Locally (IMPORTANT)
Run this script to download all weights **directly into the project folder** (not your global home folder). This makes the project self-contained:
```bash
cd "Experiment 1/radflow_edge"
python download_models.py
```
*Note: This will download DenseNet (~28MB) and CheXagent (~16GB) into `./models/` inside your project.*

### Step 3: Run the App
```bash
# Start backend
uvicorn api.main:app --host 0.0.0.0 --port 8000

# Start UI
chainlit run ui/app.py
```

---

## What This Experiment Does
RadFlow-Edge is a 4-stage pipeline that takes a raw radiology image and produces a clinical triage report.

1. **DETECTOR**: DenseNet121 scans for 18 pathologies.
2. **LOCALIZER**: GradCAM highlights and crops the anomaly.
3. **RAG**: Pulls clinical guidelines from `knowledge_base/`.
4. **ANALYZER**: CheXagent-8b generates the final VLM report.

---

## Portability Feature
The code is now hardcoded to look for weights in:
- `HSIL_Hackathon/models/xrv/`
- `HSIL_Hackathon/models/chexagent/`

This ensures that once you download the models on your new PC, the entire folder (including models) is one single unit that can be moved without re-downloading.

---

## Token Management & Support
- **Resolution**: 224x224 and 512x512 crops keep visual tokens low (~300).
- **Quantization**: Automatically uses 4-bit loading via `bitsandbytes` to stay within VRAM limits.
- **NVIDIA support**: `requirements.txt` is optimized to pull CUDA-enabled torch on your new PC.
