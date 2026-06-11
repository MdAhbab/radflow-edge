# RadFlow-Edge

> **Offline-first AI radiology triage for resource-constrained clinical environments**

RadFlow-Edge runs entirely on-device — no cloud dependency, no data leaving the facility. A single mid-range laptop can perform chest X-ray triage, GradCAM-guided anomaly localization, and AI-generated narrative reports using only local models.

---

## What it does

| Layer | What it runs |
|-------|-------------|
| **Detector** | TorchXRayVision DenseNet121 — scores 18 chest pathologies |
| **Localizer** | GradCAM — heatmap + bounding box overlay |
| **Radiology VLM** | Gemma vision on **Apple MLX** (`mlx-vlm`) — the chest-X-ray narrative |
| **Gemma services** | Gemma 4 E2B via **Ollama** — copilot chat, voice intake, agents, OCR extraction |
| **Foveal (Exp 2)** | OpenCV contrast crop — reduces VLM token load ~80% |

All AI inference is async-queued (SQLite-backed job table). The frontend polls for results; the case creation endpoint returns immediately.

### Two model runtimes, one at a time

The chest-X-ray radiology VLM runs on **Apple MLX**; the Gemma 4 services (copilot,
voice, agents, OCR) run on **Ollama**. On a memory-constrained edge box (8 GB) the
two runtimes must never be resident together, so a global execution coordinator
(`backend/model_executor.py`) serializes all model work and evicts whichever
runtime is not currently needed before loading the other. If the MLX model is
unavailable, the radiology narrative falls back to Ollama automatically. See
[Memory governance](#memory-governance) below.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.11+ | Tested on 3.11 |
| Node.js | 18+ | For the React frontend |
| [Ollama](https://ollama.com) | latest | Local LLM runtime |
| gemma4:e2b | — | Pull once: `ollama pull gemma4:e2b` |

---

## Quick start

```bash
# 1. Activate the Python environment (create it first if needed — see Setup below)
source .venv/bin/activate

# 2. Launch everything (backend + frontend + AI pipeline picker)
python run_all.py
```

Then open **http://localhost:5173**

Set `HSIL_DEV=1` before running if you want uvicorn's file watcher (hot-reload):
```bash
HSIL_DEV=1 python run_all.py
```

---

## Full Setup (fresh machine)

### 1. Python environment

```bash
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

### 2. PyTorch — pick your hardware

**Apple Silicon (M1/M2/M3/M4):**
```bash
pip install torch torchvision torchaudio
```

**NVIDIA GPU (CUDA 12.1):**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

**CPU only / Intel:**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### 3. Python dependencies

```bash
pip install -r requirements.txt
```

### 4. AI model weights

```bash
cd "Experiment 1/radflow_edge"

# Detector only — DenseNet121 (~27 MB, required)
python download_models.py

# + CheXagent-8b (~16 GB, optional — only used on NVIDIA CUDA)
python download_models.py --full
```

Weights land in `models/` at the project root (gitignored — they stay on disk only).

### 5. Ollama + Gemma 4 E2B

```bash
# Install Ollama from https://ollama.com, then:
ollama pull gemma4:e2b
```

Gemma 4 E2B handles both vision narrative reports and the clinical copilot chat. It must be running (`ollama serve`) before the backend starts — `run_all.py` checks for it automatically.

### 6. Frontend dependencies

```bash
cd Frontend
npm install
cd ..
```

---

## Manual start (without run_all.py)

```bash
# Terminal 1 — backend
source .venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd Frontend
npm run dev
```

---

## Project structure

```
radflow-edge/
├── backend/
│   ├── main.py          # FastAPI app — all routes, job queue, model orchestration
│   └── database.py      # SQLAlchemy models (cases, findings, escalations, jobs)
│
├── Experiment 1/
│   └── radflow_edge/
│       ├── core/
│       │   ├── detector.py    # DenseNet121 pathology scorer
│       │   ├── localizer.py   # GradCAM heatmap + crop
│       │   ├── analyzer.py    # CheXagent-8b VLM (NVIDIA only)
│       │   ├── rag.py         # ChromaDB retrieval
│       │   └── pipeline.py    # Full 4-stage orchestrator
│       └── download_models.py # Weight downloader
│
├── Experiment 2/
│   └── foveal_engine/
│       ├── vision_hack.py     # OpenCV foveal crop
│       └── router.py          # Hardware auto-detection
│
├── Frontend/
│   └── src/
│       ├── api.ts             # Typed API client with offline queue
│       └── app/
│           └── components/
│               └── screens/   # Worklist, CaseReview, Escalations, EHR…
│
├── Documentation/             # Architecture, roadmap, literature review
├── models/                    # Downloaded weights — gitignored
├── requirements.txt
└── run_all.py                 # Unified launcher
```

---

## Environment variables

All have safe defaults — only set them if you need to change the defaults.

| Variable | Default | Purpose |
|----------|---------|---------|
| `HSIL_PIPELINE_MODE` | `experiment1` | Active AI pipeline (`experiment1`, `experiment2`, `both`, `none`) |
| `HSIL_COPILOT_MODEL` | `gemma4:e2b` | Ollama model for the Gemma services (copilot, voice, agents, OCR) |
| `HSIL_MLX_RADIOLOGY_MODEL` | `mlx-community/gemma-3-4b-it-4bit` | MLX-VLM model for the chest-X-ray narrative |
| `HSIL_DISABLE_MLX_RADIOLOGY` | `0` | Set to `1` to force the Ollama narrative instead of MLX |
| `HSIL_MLX_MEM_LIMIT_GB` | `5.0` | Hard cap on MLX memory (keeps it off swap) |
| `HSIL_OLLAMA_NUM_CTX` | `4096` | Ollama context window (model default 131072 — big KV-cache saving) |
| `HSIL_OLLAMA_KEEP_ALIVE` | `30s` | How long Ollama keeps Gemma resident when idle |
| `HSIL_OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `HSIL_GEMMA_TIMEOUT_SEC` | `120` | Per-request timeout for Gemma calls |
| `HSIL_DISABLE_GEMMA_ANALYZER` | `0` | Set to `1` to skip the Ollama narrative fallback |
| `HSIL_ENABLE_EXP1_ANALYZER` | `auto` | Set to `1` to force-enable CheXagent on non-CUDA |
| `HSIL_DEV` | unset | Set to `1` to enable uvicorn `--reload` |
| `VITE_API_HOST` | `http://localhost:8000` | Backend base URL for the frontend build |

---

## Memory governance

The reference device is an 8 GB unified-memory Mac, so memory discipline is a
first-class concern, not an afterthought:

- **One model at a time.** A global execution slot (`backend/model_executor.py`)
  serializes all model work — detector, GradCAM, MLX radiology VLM, and every
  Ollama call — and tracks which language/vision runtime is resident.
- **MLX and Ollama never co-resident.** Before MLX runs it evicts the Ollama
  model; before an Ollama service runs it frees the MLX model (`mx.clear_cache()`).
  The MLX side is also capped with `mx.set_memory_limit` (`HSIL_MLX_MEM_LIMIT_GB`).
- **Capped Ollama context.** Every Ollama call sets `num_ctx=4096` instead of the
  131072 default, the single biggest per-call KV-cache saving.
- **Swap-aware backpressure.** The async job worker waits out high macOS swap
  pressure (bounded) before starting another model, so a backlog can't drive the
  device into a swap death-spiral.
- **Server-side KV-cache quantization (recommended):** start the Ollama service
  with `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` to roughly halve
  its KV-cache memory (these are read by `ollama serve`, not by this app):
  ```bash
  OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve
  ```

---

## API reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness check |
| `/api/v1/health` | GET | Liveness with active pipeline mode |
| `/api/v1/system/status` | GET | Runtime capabilities, model load state |
| `/api/v1/pipeline/mode` | GET / PUT | Read or change active pipeline |
| `/api/v1/cases` | GET / POST | Worklist and case creation |
| `/api/v1/cases/{id}` | GET / PATCH | Case detail and partial update |
| `/api/v1/cases/{id}/findings` | GET | AI findings for a case |
| `/api/v1/cases/{id}/download` | POST | Download report bundle |
| `/api/v1/cases/stats/summary` | GET | Worklist statistics |
| `/api/v1/escalations` | GET / POST | Escalation queue |
| `/api/v1/escalations/stats` | GET | Escalation summary |
| `/api/v1/analyze/jobs` | POST | Enqueue an analysis job directly |
| `/api/v1/analyze/jobs/{id}` | GET | Poll job status |
| `/api/v1/chat` | POST | Copilot chat against a case |
| `/api/v1/ehr` | GET | EHR patient list |

---

## Hardware support

| Hardware | Detector | GradCAM | Radiology narrative |
|----------|----------|---------|---------------------|
| Apple Silicon | MPS/CPU | MPS/CPU | **MLX-VLM** (Metal); Ollama fallback |
| NVIDIA GPU | CUDA | CUDA | CheXagent (4-bit) or Ollama |
| CPU only | CPU | CPU | Ollama (CPU) |

On Apple Silicon the radiology narrative runs on MLX (Metal GPU, unified memory);
the Gemma 4 services (copilot, voice, agents, OCR) run on Ollama. The two are
never resident at the same time — see [Memory governance](#memory-governance).

---

## Troubleshooting

**Copilot returns empty responses**
Gemma 4 E2B is a thinking model. The backend already sets `think: false` in all Ollama calls to prevent the hidden reasoning chain from consuming the token budget. If you're calling Ollama directly outside this app, add `"think": false` to your payload.

**Radiology narrative is slow on the first case / want to disable MLX**
The MLX radiology model (`HSIL_MLX_RADIOLOGY_MODEL`, ~2.5 GB) downloads on first
use and loads on the first analysis (~30 s), then stays warm. To skip MLX
entirely and use the Ollama narrative, set `HSIL_DISABLE_MLX_RADIOLOGY=1`. If MLX
fails to load for any reason the app falls back to Ollama automatically — no
configuration needed.

**Device swapping under load (8 GB)**
Start Ollama with a quantized KV cache (`OLLAMA_FLASH_ATTENTION=1
OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve`), keep `HSIL_OLLAMA_NUM_CTX=4096`, and
lower `HSIL_MLX_MEM_LIMIT_GB` if needed. Close other large apps; the radiology VLM
needs ~3.2 GB of headroom. See [Memory governance](#memory-governance).

**"Model not found" on startup**
Run the download script:
```bash
cd "Experiment 1/radflow_edge"
python download_models.py
```

**Frontend shows stale / no AI findings**
Analysis is async. After creating a case the frontend polls `/api/v1/cases/{id}/findings` every few seconds. If the job is stuck, check the backend terminal for the inference worker log lines.

**Backend port already in use**
```bash
lsof -ti:8000 | xargs kill -9
```

**Ollama not reachable**
Make sure `ollama serve` is running and reachable at `http://localhost:11434`. The backend will log a warning on startup if it cannot reach Ollama.

---

## License

MIT
