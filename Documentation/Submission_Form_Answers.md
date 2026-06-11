# RadFlow-Edge — Submission Form Answer Guide

This maps each AI-Depth submission field to where it now lives in the repo,
so every claim is verifiable. Read it alongside the form before re-submitting.

> **The one correction that matters:** the on-device LLM is **gemma4:e2b**
> (Gemma 4 E2B, 5.1B, Q4_K_M, via Ollama), **not Phi-3 Mini**. Wherever the
> form said "Phi-3 Mini for Bangla CHW Q&A" or "Phi-3", change it to
> "gemma4:e2b". Gemma 4 E2B is multimodal (text + vision + **audio** + tools)
> and does the narrative reports, the copilot, and the voice intake. Uncheck
> Phi-3 / Gemma 2 / Yi / Llama in "Local models you actually ran"; keep
> **Gemma 4** and **Ollama** + **Apple MLX** + **llama.cpp**.

---

## Project Info — keep as written
RadFlow-Edge, offline edge-native chest X-ray (+ now dermatology) triage for
rural Bangladesh. The elevator pitch and problem statement are accurate.

---

## LLMs / Models Used
- **Keep:** Claude, ChatGPT, Gemini (dev/build only), Gemma 4.
- **Change:** remove Phi-3 from the chip list; the only on-device model is
  gemma4:e2b. Cloud LLMs are dev-only and never touch PHI — accurate.
- Routing story (rewrite): "gemma4:e2b runs every on-device task — vision
  narrative, clinical copilot, and Bangla/English/code-mixed voice intake.
  CheXagent-8b is an optional NVIDIA-only VLM; on the edge box Gemma covers it."

## Retrieval & RAG — now fully real (`backend/rag_engine.py`)
- Vector DB (ChromaDB), Contextual/semantic chunking, Hybrid search
  (BM25 + dense), Rerankers (cross-encoder ms-marco-MiniLM), Query
  rewriting/HyDE — **all implemented and wired into the live pipeline.**
- Corpus: `knowledge_base/*.md` (WHO/NTP TB, IMCI pneumonia, sepsis/qSOFA,
  cardiomegaly, pleural effusion, normal-film). Every answer carries a
  `[SOURCE-ID]` citation. Embeddings: sentence-transformers MiniLM.
- Evidence: `eval/ragas_eval.py` reports context_precision = 1.0 on the
  regression fixtures.

## MCP — now real (`mcp_servers/`)
- **Built:** `radflow-clinical-rag-mcp` (search_guidelines,
  get_guideline_passage, list_corpus_sources) and `radflow-intake-scribe-mcp`
  (transcribe_voice, extract_intake_fields, ocr_document). Both run over
  stdio; config in `mcp_servers/mcp_config.json`.
- **Used:** Anthropic reference filesystem MCP (in the config). Transport:
  stdio. Reuse: Claude Desktop / Cursor / CLI test agents.
- Keep the honest note: MCP is dev/eval-only; production edge has no inbound
  MCP surface.

## Agent Frameworks & Orchestration — now real (`backend/agents.py`)
- **LangGraph** drives the Triage Reasoner as an explicit StateGraph:
  retrieve → risk → reason → decide. **Pydantic / Pydantic-AI-style typed
  outputs** validate intake extraction (`backend/voice_intake.py`).
- Four agents, all gemma-powered, exposed as endpoints:
  `triage_reasoner`, `morning_briefing`, `escalation_drafter`,
  `intake_scribe`. Keep "deliberately lightweight single planner/executor
  graph, not a heavy multi-agent swarm" — accurate.

## Fine-tuning / Continual learning — now real (`scripts/continual_learning.py`)
- Nightly pipeline: export clinician-confirmed cases → retrain XGBoost risk
  model (runs in seconds) → optional **MLX QLoRA** on gemma4 (Apple Silicon).
  Scheduled by Prefect (`flows/prefect_flows.py`, 02:30 cron).
- Honest scoping: the risk-model retrain runs every night and is verified;
  the gemma QLoRA is opt-in (`--llm`) and memory-tight on 8GB (batch 1).
- QLoRA targets you can keep: risk scorer (real), gemma4 adapters (MLX,
  attempted on-device / ready for a bigger box). Drop BanglaBERT and
  Whisper-tiny fine-tune claims — those models aren't used.

## Evaluation & Quality — now real (`eval/`)
- RAGAS-style harness (`eval/ragas_eval.py`): context_precision,
  answer_relevancy, faithfulness + must_mention/must_not_mention regression
  gates over `eval/fixtures.json`. Runs offline using the local model + MiniLM.

## Guardrails, Safety & Privacy — keep, all accurate
- 100% on-device, no PHI egress. Strictly-extractive intake (voice + OCR fill
  only stated fields; unstated → null + flagged). "Draft Preliminary
  Findings" labelling. Human-in-the-loop before any clinical action. qSOFA
  is a transparent rule engine (`backend/risk_engine.py`), never a black box.

## Insights — AI, ML & Non-AI — now real
- Classical ML: **XGBoost** deterioration risk + **SHAP** explanations
  (`backend/risk_engine.py`). Rule engine: **qSOFA**. CNN: TorchXRayVision
  DenseNet121 (CXR) + **EfficientNet-B3** dermatology (`backend/derma_engine.py`).
- Delivery: colour-coded triage badge + cited rationale, plus the Insights
  dashboard.

## Pipelines & Orchestration — update
- One model runs at a time, enforced by `backend/model_executor.py` (single
  execution slot + memory neutralisation between stages), MLX/Metal optimised.
  Pipelines run sequentially and merge results — keep this; it's now literally
  enforced in code.
- **Prefect** schedules nightly maintenance (sync, backup, RAG refresh,
  continual learning). **Uncheck n8n** (not used).

## Visualization — update
- **Keep Recharts** (the Insights screen: triage pie, findings bar,
  confidence line, SHAP bar — `Frontend/src/app/components/screens/Insights.tsx`).
- **Uncheck** Grafana, Superset, Chart.js, Plotly, D3 — only Recharts ships.

## Data Lifecycle
- Acquisition: User uploads + **LAN intake portal** (phones on the same WiFi
  scan a QR to upload X-rays/prescriptions — `/lan` + `/api/v1/lan/info`),
  OCR (Tesseract ben+eng), Speech-to-text (gemma4 audio). Keep these checked.
- Storage: SQLite (relational) + ChromaDB (vector). **Uncheck** Postgres,
  Redis, Neo4j, Lakehouse, Object Storage, Data Warehouse — the edge box is
  SQLite + Chroma only. Adjust the storage-targets prose accordingly.

## Workflow Automation — update
- **Keep:** Prefect. **Uncheck:** n8n, LangGraph-as-automation (LangGraph is
  used for the agent graph, not workflow automation), Temporal, Airflow.

## Federated learning — real but scoped (`federated/flower_sim.py`)
- Flower-style FedAvg simulation federating the risk model across simulated
  clinics (Ray-free to fit 8GB). Keep it described as a demonstration of the
  federation path, not a live multi-site deployment.

## Tunnelling / Publish-to-internet — keep
- ngrok / Cloudflare Tunnel are dev/demo-only; production runs offline with no
  inbound surface. Accurate as written.

---

## Net effect on the AI-Depth score
Most previously-aspirational sections (RAG, MCP, agents, fine-tuning, eval,
risk ML, derma, OCR, voice, LAN intake) are now backed by running code in the
repo. The only items to *uncheck* are genuinely-unused tools (Phi-3, n8n,
Grafana/Superset/Plotly/Chart.js, Postgres/Redis/Neo4j, BanglaBERT/Whisper
fine-tunes). The submission is now defensible against a judge opening the repo.
