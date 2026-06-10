# RadFlow-Edge — Developer Setup Guide

This guide covers everything needed to get a development environment running from a fresh clone.

---

## What you need before you start

- **Python 3.11+** (`python --version`)
- **Node.js 18+** (`node --version`, `npm --version`)
- **Ollama** — [download from ollama.com](https://ollama.com), then run `ollama pull gemma4:e2b`
- **Git**

You do NOT need a GPU. Everything runs on CPU; Apple Silicon MPS is used automatically when available.

---

## Step 1 — Clone and enter the repo

```bash
git clone https://github.com/MdAhbab/radflow-edge.git
cd radflow-edge
```

---

## Step 2 — Python environment

```bash
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

Install PyTorch first (hardware-specific), then the rest:

```bash
# Apple Silicon
pip install torch torchvision torchaudio

# NVIDIA CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# CPU-only / Intel
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

```bash
pip install -r requirements.txt
```

---

## Step 3 — Download model weights

The `models/` directory is gitignored. Run the download script once:

```bash
cd "Experiment 1/radflow_edge"
python download_models.py        # DenseNet121 — ~27 MB, required
python download_models.py --full # + CheXagent-8b — ~16 GB, NVIDIA only
cd ../..
```

Weights land at `models/xrv/` and `models/chexagent/`. Move the whole project folder freely — the paths are relative to the project root.

---

## Step 4 — Ollama + Gemma 4 E2B

```bash
ollama pull gemma4:e2b   # ~5 GB download, one time
ollama serve             # keep this running in a separate terminal
```

Gemma 4 E2B is used for:
- Narrative report generation (when CheXagent is unavailable)
- Copilot chat responses

The backend detects Ollama on startup. If it's not running you'll see a warning in the terminal but the rest of the app still works (analysis jobs fall back to detector-only output).

---

## Step 5 — Frontend dependencies

```bash
cd Frontend
npm install
cd ..
```

---

## Step 6 — Run

```bash
# Option A: unified launcher (recommended)
python run_all.py

# Option B: manual (two terminals)
# Terminal 1:
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
# Terminal 2:
cd Frontend && npm run dev
```

Open **http://localhost:5173**.

---

## Folder layout (what to edit where)

| What you're changing | Where |
|----------------------|-------|
| API routes, job queue, Ollama calls | `backend/main.py` |
| Database schema (SQLAlchemy ORM) | `backend/database.py` |
| DenseNet detector | `Experiment 1/radflow_edge/core/detector.py` |
| GradCAM localizer | `Experiment 1/radflow_edge/core/localizer.py` |
| CheXagent VLM wrapper | `Experiment 1/radflow_edge/core/analyzer.py` |
| RAG / ChromaDB | `Experiment 1/radflow_edge/core/rag.py` |
| Foveal crop preprocessing | `Experiment 2/foveal_engine/vision_hack.py` |
| Typed API client | `Frontend/src/api.ts` |
| Screen components | `Frontend/src/app/components/screens/` |
| Shared UI primitives | `Frontend/src/app/components/ui/` |
| Global CSS + fonts | `Frontend/src/styles/` |
| Route definitions | `Frontend/src/app/routes.tsx` |

---

## Key environment variables

See the full table in README.md. The most common ones during development:

```bash
HSIL_DEV=1              # enables uvicorn --reload (file watcher)
HSIL_PIPELINE_MODE=none # boot without loading any AI models (fast, for frontend work)
HSIL_DISABLE_GEMMA_ANALYZER=1  # skip Gemma narrative generation
```

---

## TypeScript type-check

```bash
cd Frontend
npm run typecheck
```

---

## Production build

```bash
cd Frontend
npm run build   # outputs to Frontend/dist/
```

The FastAPI backend serves `Frontend/dist/` as static files when the directory exists (see `backend/main.py` static mount).

---

## Uploading test images

Drop X-ray images (PNG, JPEG, DICOM, BMP, TIFF — max 50 MB) via the **New Report** screen. Uploaded files land in `.files/` (gitignored) and are referenced by path in the database.

The `bd_sim_*` images in your local `.files/` directory are simulated Bangladesh dataset samples useful for smoke-testing. They are not committed to the repository.

---

## Common issues

| Symptom | Fix |
|---------|-----|
| Port 8000 in use | `lsof -ti:8000 \| xargs kill -9` |
| Copilot returns blank | Ollama not running — `ollama serve` |
| Findings never appear | Check backend terminal for inference worker errors |
| `torch` not found | Activate `.venv` before running |
| `npm: command not found` | Install Node.js 18+ |
| Frontend TypeScript errors | `cd Frontend && npm run typecheck` for details |
