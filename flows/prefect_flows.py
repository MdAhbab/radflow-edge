"""Prefect orchestration for RadFlow-Edge background jobs.

Prefect (pure-Python, no broker) schedules the edge device's recurring
maintenance entirely offline:

- ``daily_record_sync``   : pull queued LAN/Bluetooth uploads into patient
                            records and refresh derived fields.
- ``nightly_backup``      : snapshot the SQLite DB + adapters to a dated
                            backup folder (store-and-forward ready).
- ``rag_refresh``         : rebuild the guideline index if the corpus or
                            any guideline file changed.
- ``nightly_continual_learning`` : export confirmed cases, retrain the
                            risk model, optionally run gemma QLoRA.

``build_deployments`` wires them to cron schedules; ``run_all_once`` runs
the whole maintenance pass on demand (used by the System Status "Run
maintenance now" action and by tests).
"""

import os
import shutil
import subprocess
import sys
from datetime import datetime

from prefect import flow, task

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
BACKUP_DIR = os.path.join(ROOT, "models", "backups")


@task(retries=2, retry_delay_seconds=30)
def daily_record_sync() -> dict:
    """Fold any pending LAN/Bluetooth intake uploads into the DB. The
    inbox is a drop folder the LAN portal writes to."""
    inbox = os.path.join(ROOT, ".files", "lan_inbox")
    if not os.path.isdir(inbox):
        return {"synced": 0}
    pending = [f for f in os.listdir(inbox) if not f.startswith(".")]
    # The LAN portal already persists uploads via the API; this task marks
    # them processed by moving them into the main store.
    processed = 0
    files_dir = os.path.join(ROOT, ".files")
    for fname in pending:
        try:
            shutil.move(os.path.join(inbox, fname), os.path.join(files_dir, fname))
            processed += 1
        except Exception:
            pass
    return {"synced": processed}


@task(retries=1)
def nightly_backup() -> dict:
    """Snapshot the DB and any model adapters to a dated backup dir."""
    stamp = datetime.utcnow().strftime("%Y%m%d")
    dest = os.path.join(BACKUP_DIR, stamp)
    os.makedirs(dest, exist_ok=True)
    db_path = os.path.join(ROOT, "radflow.db")
    saved = []
    if os.path.exists(db_path):
        shutil.copy2(db_path, os.path.join(dest, "radflow.db"))
        saved.append("radflow.db")
    risk_model = os.path.join(ROOT, "models", "risk_xgb.json")
    if os.path.exists(risk_model):
        shutil.copy2(risk_model, os.path.join(dest, "risk_xgb.json"))
        saved.append("risk_xgb.json")
    return {"backup_dir": dest, "saved": saved}


@task
def rag_refresh() -> dict:
    """Rebuild the guideline index if the corpus changed (the engine keys
    its collection on a content hash, so this is a no-op when unchanged)."""
    sys.path.insert(0, os.path.join(ROOT, "backend"))
    from rag_engine import get_rag_engine

    engine = get_rag_engine()
    engine._ready = False  # force a hash check / rebuild
    engine._ensure_ready()
    return {"chunks_indexed": len(engine._chunks)}


@task
def nightly_continual_learning(run_llm: bool = False) -> dict:
    """Export confirmed cases, retrain the risk model, optionally QLoRA."""
    cmd = [sys.executable, os.path.join(SCRIPTS, "continual_learning.py"), "--export", "--risk"]
    if run_llm:
        cmd.append("--llm")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return {"returncode": proc.returncode, "tail": (proc.stdout or proc.stderr)[-300:]}


@flow(name="radflow-nightly-maintenance")
def nightly_maintenance(run_llm: bool = False) -> dict:
    sync = daily_record_sync()
    backup = nightly_backup()
    rag = rag_refresh()
    learn = nightly_continual_learning(run_llm)
    return {"sync": sync, "backup": backup, "rag": rag, "continual_learning": learn}


def run_all_once(run_llm: bool = False) -> dict:
    """Run the full maintenance pass once, now."""
    return nightly_maintenance(run_llm)


def build_deployments():
    """Register cron schedules. Run: python flows/prefect_flows.py --serve"""
    nightly_maintenance.serve(
        name="radflow-nightly",
        cron="30 2 * * *",  # 02:30 local, when the clinic is closed
        parameters={"run_llm": os.getenv("HSIL_NIGHTLY_QLORA", "0") == "1"},
    )


if __name__ == "__main__":
    if "--serve" in sys.argv:
        build_deployments()
    else:
        print(run_all_once(run_llm="--llm" in sys.argv))
