
# HSIL Hackathon 2026 - RadFlow-Edge & Foveal Engine

> **AI-Powered Radiological Triage System for Resource-Constrained Environments**

Harvard Health Systems Innovation Lab Hackathon - April 10-11, 2026

---

## 🚀 Super Quick Start (Recommended)

**One-Click Launcher** - Runs Backend + Frontend + AI Pipeline:

```bash
# Windows
run_all.bat

# Mac/Linux
./run_all.sh

# Or directly with Python
python run_all.py
```

The launcher will:
- ✅ Check all dependencies
- ✅ Ask which AI pipeline to use (Experiment 1, 2, or both)
- ✅ Start the backend API server
- ✅ Start the frontend dev server
- ✅ Monitor all services and handle cleanup

Pipeline mode behavior:
- `Experiment 1` -> `/api/v1/analyze` uses RadFlow
- `Experiment 2` -> `/api/v1/analyze` uses Foveal pipeline path
- `Both` -> both pipelines available (RadFlow default analyze, Foveal endpoint available)
- `Backend + Frontend Only` -> AI analysis disabled

**Then open**: http://localhost:5173

---

## Manual Setup (Alternative)

### 1. Install Python Dependencies

```bash
# Create virtual environment
cd HSIL_Hackathon
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Mac/Linux)
source .venv/bin/activate
```

### 2. Install PyTorch (Choose Your Hardware)

**For Intel ARC GPU (Windows):**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install intel-extension-for-pytorch
```

**For NVIDIA GPU:**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

**For Apple Silicon (Mac M1/M2/M3):**
```bash
pip install torch torchvision torchaudio
pip install mlx mlx-vlm  # Optional: for optimized inference
```

**For CPU Only:**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### 3. Install Other Dependencies

```bash
pip install -r requirements.txt
```

### 4. Download AI Models

```bash
cd "Experiment 1/radflow_edge"

# Quick download (TorchXRayVision only - ~28MB)
python download_models.py

# Full download (includes CheXagent-8b - ~16GB)
python download_models.py --full
```

### 5. Start the Backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: http://localhost:8000

### 6. Start the Frontend

```bash
cd Frontend
npm install  # First time only
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Project Structure

```
HSIL_Hackathon/
├── backend/                    # FastAPI Backend (NEW)
│   ├── main.py                 # API endpoints
│   └── hardware.py             # Hardware detection utility
│
├── Experiment 1/               # RadFlow-Edge (CNN + VLM Pipeline)
│   └── radflow_edge/
│       ├── core/
│       │   ├── detector.py     # TorchXRayVision CNN
│       │   ├── localizer.py    # GradCAM heatmaps
│       │   ├── analyzer.py     # CheXagent VLM
│       │   ├── rag.py          # RAG with ChromaDB
│       │   └── pipeline.py     # Full pipeline orchestration
│       ├── api/
│       │   └── main.py         # Legacy API (use backend/ instead)
│       └── download_models.py  # Model download script
│
├── Experiment 2/               # Foveal Engine (Vision Hack)
│   └── foveal_engine/
│       ├── vision_hack.py      # Foveal preprocessing
│       ├── router.py           # Hardware detection
│       └── d_rova_concept.py   # Token routing concept
│
├── Frontend/                   # React + TypeScript UI
│   ├── src/
│   │   ├── api.ts              # Backend API client
│   │   └── app/
│   │       └── components/
│   │           └── screens/
│   │               ├── Worklist.tsx
│   │               ├── CaseReview.tsx
│   │               └── ...
│   └── package.json
│
├── models/                     # Downloaded AI models (gitignored)
│   ├── xrv/                    # TorchXRayVision weights
│   ├── chexagent/              # CheXagent-8b (optional)
│   └── chroma_db/              # RAG vector database
│
└── requirements.txt            # Python dependencies
```

---

## Hardware Support

| Hardware | Detection Method | VLM Strategy |
|----------|------------------|--------------|
| **Intel ARC** | `intel-extension-for-pytorch` | CPU inference (bitsandbytes not supported) |
| **NVIDIA GPU** | `torch.cuda` | 4-bit quantization with bitsandbytes |
| **Apple Silicon** | MPS backend | mlx-vlm or CPU fallback |
| **CPU** | Fallback | Full precision (slow) |

The system automatically detects your hardware and configures the optimal inference path.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check API status and hardware info |
| `/api/v1/system/status` | GET | Runtime status, capabilities, active pipeline mode |
| `/api/v1/pipeline/mode` | GET/PUT | Read or update backend pipeline mode |
| `/api/v1/cases` | GET/POST | Worklist and case creation |
| `/api/v1/cases/stats/summary` | GET | Case summary statistics |
| `/api/v1/escalations` | GET/POST | Escalation queue |
| `/api/v1/escalations/stats` | GET | Escalation summary statistics |
| `/api/v1/analyze` | POST | Analyze X-ray (full RadFlow pipeline) |
| `/api/v1/foveal` | POST | Foveal preprocessing only |
| `/api/v1/chat` | POST | AI Copilot chat |

Frontend API mode indicator:
- The UI auto-detects backend capabilities from OpenAPI.
- `Live API` badge appears when unified endpoints (`cases` + `escalations`) are available.
- `Fallback API` appears when only partial/legacy endpoints are available.

### Example API Usage

```python
import requests

# Analyze X-ray
with open("xray.png", "rb") as f:
    response = requests.post(
        "http://localhost:8000/api/v1/analyze",
        files={"file": f},
        data={"patient_context": "42M, persistent cough, night sweats"}
    )
    print(response.json())
```

---

## Experiments Overview

### Experiment 1: RadFlow-Edge

A 4-stage pipeline for chest X-ray analysis:

1. **Detection**: TorchXRayVision DenseNet121 detects 18 pathologies
2. **Localization**: GradCAM generates heatmaps and bounding boxes
3. **RAG Retrieval**: ChromaDB retrieves relevant medical guidelines
4. **Analysis**: CheXagent-8b generates detailed reports

### Experiment 2: Foveal Engine

Efficient preprocessing for high-resolution images:

1. **Vision Hack**: Crops 512x512 anomaly regions from 2000x2000+ images
2. **Token Reduction**: Reduces VLM token count by ~80%
3. **Hardware Routing**: Auto-detects optimal compute backend

---

## Database Recommendation

For the HSIL Hackathon, we recommend:

### Development/Demo: SQLite + ChromaDB
- **SQLite**: Patient cases, worklist, audit logs
- **ChromaDB**: RAG vector embeddings (already integrated)

### Production Scale: PostgreSQL + pgvector
- **PostgreSQL**: ACID compliance for patient data
- **pgvector**: Native vector similarity search

The current implementation uses ChromaDB for RAG, which is sufficient for the hackathon demo. Patient data in the frontend is mocked - connect to a real database for production.

---

## Troubleshooting

### App shows Fallback API badge
You likely started a legacy API entrypoint. Start the unified backend from `backend/main.py` (or use `python run_all.py`) so `/api/v1/cases` and `/api/v1/escalations` are available.

### "Model not found" error
Run the download script:
```bash
cd "Experiment 1/radflow_edge"
python download_models.py
```

### "CUDA out of memory" on NVIDIA
The system auto-uses 4-bit quantization. If still failing, use CPU:
```python
# In analyzer.py, force CPU:
self.device = "cpu"
```

### Intel ARC not detected
Ensure Intel Extension for PyTorch is installed:
```bash
pip install intel-extension-for-pytorch
```

### Frontend can't connect to backend
Check CORS origins in `backend/main.py` match your frontend URL.

---

## License

MIT License - Harvard HSIL Hackathon 2026

## Team

Built for the Harvard Health Systems Innovation Lab Hackathon 2026
=======
# hsil
This is made for hsil hackathon
>>>>>>> d09c0474e139c00492cee7a45685354daad9eb1a
