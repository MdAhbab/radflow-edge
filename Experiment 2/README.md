# Experiment 2: Foveal Triage Engine — Vision Hack + D-RoVA Architecture

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
Even for Experiment 2, some features may benefit from the local weights. Run this script in the radflow_edge folder (it populates the shared root `models/` folder):
```bash
cd "Experiment 1/radflow_edge"
python download_models.py
```
*Note: This will download DenseNet (~28MB) and CheXagent (~16GB) into the root `/models/` directory.*

### Step 3: Run the App
```bash
cd "Experiment 2/ui"
chainlit run app.py
```

---

## What This Experiment Does
Experiment 2 focuses on high-speed anomaly detection using OpenCV (Vision Hack) and the novel D-RoVA architecture concept.

1. **Vision Hack**: Uses contrast analysis to crop a 512x512 "Foveal" region instantly.
2. **Hardware Router**: Automatically detects Apple Silicon vs NVIDIA GPUs.
3. **D-RoVA**: Conceptual token router that drops irrelevant visual tokens.

---

## Portability Feature
This experiment is designed to work alongside Experiment 1, sharing the same `./models/` directory. By keeping weights local to the project, you can move the entire workspace between machines once the initial download is complete.

---

## Hardware Optimization
- **Mac**: Uses `mlx-vlm` if installed for native M-series performance.
- **NVIDIA**: Uses the standard 4-bit `transformers` path for high-end GPUs.
