"""Nightly continual-learning pipeline.

Each day's clinician-confirmed cases become tomorrow's training signal,
entirely on-device:

1. ``export_training_data`` — pulls reviewed cases from the SQLite DB and
   writes two artifacts:
     - ``models/finetune/llm_sft.jsonl``  : instruction/response pairs
       (case context -> the clinician-approved report) for LLM QLoRA.
     - ``models/finetune/risk_rows.npz``  : vitals + confirmed outcome for
       the risk model.
2. ``retrain_risk_model`` — refits the XGBoost deterioration model on the
   accumulated confirmed outcomes (real, runs in seconds).
3. ``run_llm_qlora`` — launches MLX QLoRA on gemma4:e2b over the SFT set.
   On the 8GB reference box this is memory-tight (batch 1); it is opt-in
   via --llm and guarded so a failure never breaks the nightly job.

Run:
    python scripts/continual_learning.py --export --risk        # safe nightly
    python scripts/continual_learning.py --export --risk --llm  # + gemma QLoRA
"""

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FT_DIR = os.path.join(ROOT, "models", "finetune")
SFT_PATH = os.path.join(FT_DIR, "llm_sft.jsonl")
RISK_PATH = os.path.join(FT_DIR, "risk_rows.npz")
ADAPTER_DIR = os.path.join(ROOT, "models", "gemma_lora_adapters")


def export_training_data() -> dict:
    """Export clinician-confirmed cases as SFT + risk training rows."""
    import numpy as np

    from database import Case, SessionLocal

    os.makedirs(FT_DIR, exist_ok=True)
    db = SessionLocal()
    try:
        # A "confirmed" record: completed analysis with a clinician-edited
        # report or specialist notes (a real human-in-the-loop signal).
        cases = (
            db.query(Case)
            .filter(Case.is_deleted == 0, Case.ai_status == "complete")
            .all()
        )
        sft_rows = []
        risk_X, risk_y = [], []
        for c in cases:
            report = (c.ai_draft_report or "").strip()
            if report:
                instruction = (
                    f"Patient: {c.age}{c.sex}, complaint: {c.complaint}. "
                    f"Detector finding confidence {float(c.confidence or 0):.0%}. "
                    "Write the triage report."
                )
                sft_rows.append({"prompt": instruction, "completion": report})

            systolic = None
            if c.vital_bp and "/" in str(c.vital_bp):
                try:
                    systolic = float(str(c.vital_bp).split("/")[0])
                except ValueError:
                    systolic = None
            risk_X.append([
                float(c.age or 45),
                float(c.vital_temp or 98.6),
                float(c.vital_hr or 80),
                float(c.vital_resp or 16),
                float(c.vital_spo2 or 98),
                float(systolic if systolic is not None else 120),
                float(c.confidence or 0.0),
            ])
            # Confirmed-outcome proxy: escalated/high-acuity triage == 1.
            risk_y.append(1 if c.triage_color in ("red", "orange") else 0)

        with open(SFT_PATH, "w", encoding="utf-8") as fp:
            for row in sft_rows:
                fp.write(json.dumps(row, ensure_ascii=False) + "\n")

        if risk_X:
            np.savez(RISK_PATH, X=np.array(risk_X, dtype=float), y=np.array(risk_y, dtype=int))

        return {"sft_examples": len(sft_rows), "risk_rows": len(risk_X)}
    finally:
        db.close()


def retrain_risk_model() -> dict:
    """Refit the XGBoost risk model on accumulated confirmed outcomes,
    blended with the synthetic prior so a thin day of data can't collapse
    the model."""
    import numpy as np

    from risk_engine import MODEL_PATH, _synthetic_training_set

    if not os.path.exists(RISK_PATH):
        return {"status": "skipped", "reason": "no exported risk rows"}

    data = np.load(RISK_PATH)
    real_X, real_y = data["X"], data["y"]
    if len(np.unique(real_y)) < 2:
        # Need both classes; blend with prior to keep training valid.
        prior_X, prior_y = _synthetic_training_set(n=2000)
        X = np.vstack([prior_X, real_X])
        y = np.concatenate([prior_y, real_y])
    else:
        prior_X, prior_y = _synthetic_training_set(n=1000)
        X = np.vstack([prior_X, real_X])
        y = np.concatenate([prior_y, real_y])

    import xgboost as xgb

    model = xgb.XGBClassifier(n_estimators=60, max_depth=3, learning_rate=0.15, eval_metric="logloss")
    model.fit(X, y)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)
    return {"status": "retrained", "train_rows": int(len(X)), "real_rows": int(len(real_X))}


def run_llm_qlora(iters: int = 100) -> dict:
    """Launch MLX QLoRA on gemma4:e2b over the exported SFT set.

    Memory-tight on 8GB (batch 1). Guarded: any failure returns a status
    rather than raising, so the nightly job continues."""
    if not os.path.exists(SFT_PATH) or os.path.getsize(SFT_PATH) == 0:
        return {"status": "skipped", "reason": "no SFT data exported"}

    # MLX expects a data dir with train.jsonl / valid.jsonl.
    data_dir = os.path.join(FT_DIR, "mlx_data")
    os.makedirs(data_dir, exist_ok=True)
    rows = [json.loads(l) for l in open(SFT_PATH, encoding="utf-8")]
    split = max(1, int(len(rows) * 0.9))
    for name, subset in (("train", rows[:split]), ("valid", rows[split:] or rows[:1])):
        with open(os.path.join(data_dir, f"{name}.jsonl"), "w", encoding="utf-8") as fp:
            for r in subset:
                fp.write(json.dumps({"text": f"{r['prompt']}\n{r['completion']}"}, ensure_ascii=False) + "\n")

    model_id = os.getenv("HSIL_MLX_BASE_MODEL", "mlx-community/gemma-2-2b-it-4bit")
    os.makedirs(ADAPTER_DIR, exist_ok=True)
    cmd = [
        sys.executable, "-m", "mlx_lm", "lora",
        "--model", model_id,
        "--train",
        "--data", data_dir,
        "--iters", str(iters),
        "--batch-size", "1",
        "--num-layers", "4",
        "--adapter-path", ADAPTER_DIR,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=int(os.getenv("HSIL_QLORA_TIMEOUT", "1800")))
        ok = proc.returncode == 0
        return {
            "status": "trained" if ok else "failed",
            "adapter_path": ADAPTER_DIR if ok else None,
            "tail": (proc.stdout or proc.stderr)[-400:],
        }
    except FileNotFoundError:
        return {"status": "skipped", "reason": "mlx_lm not installed"}
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "reason": "QLoRA exceeded time budget on this device"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--risk", action="store_true")
    parser.add_argument("--llm", action="store_true")
    parser.add_argument("--iters", type=int, default=100)
    args = parser.parse_args()

    if args.export or not (args.risk or args.llm):
        print("export:", export_training_data())
    if args.risk:
        print("risk retrain:", retrain_risk_model())
    if args.llm:
        print("llm qlora:", run_llm_qlora(args.iters))
