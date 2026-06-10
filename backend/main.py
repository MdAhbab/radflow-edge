import os
import shutil
import uuid
import sys
import time
import json
import queue
import threading
import tempfile
import traceback
import hashlib
import importlib.util
import re
import requests
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from collections import defaultdict, deque

from database import (
    SessionLocal,
    Case,
    Finding,
    Escalation,
    SystemStats,
    InferenceLedger,
    InferenceJob,
    EscalationEvent,
)

app = FastAPI(title="HSIL Hackathon API")

ALLOWED_PIPELINES = {"experiment1", "experiment2", "both", "none"}


def _model_state_file_path() -> str:
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(project_root, ".active_ai_model")


def _load_active_model() -> str:
    env_model = os.getenv("HSIL_PIPELINE_MODE")
    if env_model and env_model.lower() in ALLOWED_PIPELINES:
        return env_model.lower()

    try:
        with open(_model_state_file_path(), "r", encoding="utf-8") as f:
            persisted = f.read().strip().lower()
            if persisted in ALLOWED_PIPELINES:
                return persisted
    except Exception:
        pass

    return "experiment1"


def _persist_active_model(model_id: str) -> None:
    if model_id not in ALLOWED_PIPELINES:
        return
    with open(_model_state_file_path(), "w", encoding="utf-8") as f:
        f.write(model_id)


# Global state for active AI model
active_ai_model = _load_active_model()

# Lazy-loaded model/pipeline instances
_exp1_detector = None
_exp1_localizer = None
_exp1_analyzer = None
_exp1_analyzer_error = None
_exp2_preprocessor = None
_exp2_backend_label = None

# Runtime telemetry state for /api/v1/system/status
APP_START_TIME = datetime.utcnow()
RECENT_ERROR_COUNT = 0
ACTIVE_USER_WINDOW_SECONDS = 300
REQUEST_ACTIVITY: Dict[str, datetime] = {}

# Endpoint telemetry and reliability metrics. Keys are route templates
# (e.g. "GET /api/v1/cases/{patient_id}"), capped so unmatched paths cannot
# grow these maps without bound on a long-running device.
ENDPOINT_METRICS: Dict[str, Dict[str, float]] = defaultdict(lambda: {"count": 0, "errors": 0, "total_ms": 0, "max_ms": 0})
OBS_LATENCY_WINDOWS: Dict[str, deque] = defaultdict(lambda: deque(maxlen=200))
ENDPOINT_METRICS_MAX_KEYS = 200
INFERENCE_QUEUE: "queue.Queue[str]" = queue.Queue()
INFERENCE_WORKER_STARTED = False
INFERENCE_WORKER_LOCK = threading.Lock()

# Model inference is serialized: concurrent torch runs on shared-memory edge
# hardware multiply peak RSS and push macOS into swap. RLock because consensus
# re-enters the experiment runners within one logical analysis.
PIPELINE_LOCK = threading.RLock()

# Configurable triage policy rules (can be replaced per-hospital).
POLICY_RULES: Dict[str, Any] = {
    "red_confidence_threshold": 0.80,
    "orange_confidence_threshold": 0.55,
    "low_confidence_review_threshold": 0.35,
    "consensus_trigger_confidence": 0.70,
    "high_risk_symptoms": ["hemoptysis", "night sweats", "weight loss", "respiratory distress", "chest pain"],
    "vital_overrides": {
        "spo2_below": 92,
        "resp_above": 28,
        "hr_above": 120,
        "temp_above": 38.5,
    },
}

try:
    import psutil  # type: ignore
except Exception:
    psutil = None

# Setup StaticFiles for uploaded/copied images
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files_dir = os.path.join(BASE_DIR, ".files")
os.makedirs(files_dir, exist_ok=True)
app.mount("/.files", StaticFiles(directory=files_dir), name="files")

# Make experiment modules importable even with space-containing folder names
EXP1_CORE_DIR = os.path.join(BASE_DIR, "Experiment 1", "radflow_edge", "core")
EXP2_ENGINE_DIR = os.path.join(BASE_DIR, "Experiment 2")
if EXP1_CORE_DIR not in sys.path:
    sys.path.append(EXP1_CORE_DIR)
if EXP2_ENGINE_DIR not in sys.path:
    sys.path.append(EXP2_ENGINE_DIR)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Global Exception Middleware to prevent server crashes
from starlette.requests import Request
from starlette.responses import JSONResponse


@app.middleware("http")
async def activity_middleware(request: Request, call_next):
    client_host = request.client.host if request.client else "unknown"
    now = datetime.utcnow()
    REQUEST_ACTIVITY[client_host] = now
    t0 = time.perf_counter()

    # Prune stale activity entries to keep active users meaningful.
    cutoff = now - timedelta(seconds=ACTIVE_USER_WINDOW_SECONDS)
    stale_hosts = [host for host, ts in REQUEST_ACTIVITY.items() if ts < cutoff]
    for host in stale_hosts:
        REQUEST_ACTIVITY.pop(host, None)

    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # Key metrics by route template, not the concrete URL, so per-patient
    # paths collapse into one bucket instead of accumulating forever.
    route = request.scope.get("route")
    path_template = getattr(route, "path", None) or request.url.path
    path_key = f"{request.method} {path_template}"
    if path_key in ENDPOINT_METRICS or len(ENDPOINT_METRICS) < ENDPOINT_METRICS_MAX_KEYS:
        metric = ENDPOINT_METRICS[path_key]
        metric["count"] += 1
        metric["total_ms"] += elapsed_ms
        metric["max_ms"] = max(metric["max_ms"], elapsed_ms)
        if response.status_code >= 400:
            metric["errors"] += 1
        OBS_LATENCY_WINDOWS[path_key].append(elapsed_ms)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    global RECENT_ERROR_COUNT
    RECENT_ERROR_COUNT += 1
    error_id = uuid.uuid4().hex[:12]
    print(f"CRITICAL ERROR [{error_id}] {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    _write_event("unhandled_error", {"errorId": error_id, "path": request.url.path, "error": str(exc)[:500]})
    # Internals stay in the server log; clients get a correlation id only.
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "errorId": error_id},
    )


def _format_time_waiting(created_at: Optional[datetime]) -> str:
    if not created_at:
        return "0h 0m"
    total_minutes = max(0, int((datetime.utcnow() - created_at).total_seconds() // 60))
    hours, minutes = divmod(total_minutes, 60)
    return f"{hours}h {minutes}m"


def _format_uptime(delta: timedelta) -> str:
    total_seconds = max(0, int(delta.total_seconds()))
    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def _format_case_time_local(dt: Optional[datetime]) -> str:
    if not dt:
        return "00:00"

    try:
        # Keep naive datetimes as-is (already local in our dataset/seeding).
        if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
            return dt.strftime("%H:%M")
        return dt.astimezone().strftime("%H:%M")
    except Exception:
        return dt.strftime("%H:%M")


def _observability_log_path() -> str:
    logs_dir = os.path.join(BASE_DIR, ".logs")
    os.makedirs(logs_dir, exist_ok=True)
    return os.path.join(logs_dir, "events.jsonl")


def _write_event(event_type: str, payload: Dict[str, Any]) -> None:
    try:
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "eventType": event_type,
            "payload": payload,
        }
        with open(_observability_log_path(), "a", encoding="utf-8") as fp:
            fp.write(json.dumps(event, ensure_ascii=True) + "\n")
    except Exception:
        pass


def _hash_image(image_path: str) -> str:
    hasher = hashlib.sha256()
    with open(image_path, "rb") as fp:
        while True:
            chunk = fp.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _extract_top_pathology(analysis: Dict[str, Any]) -> str:
    findings = analysis.get("findings") or []
    if findings and isinstance(findings, list):
        return str(findings[0].get("disease") or "unknown")
    summary = str(analysis.get("summary") or "").strip()
    if not summary:
        return "unknown"

    top_match = re.search(r"top\s*finding\s*:\s*([^\n|]+)", summary, flags=re.IGNORECASE)
    if top_match:
        return top_match.group(1).strip()[:150]

    if "no significant abnormalities" in summary.lower():
        return "no significant abnormalities"

    return "unknown"


def _confidence_bucket(conf: float) -> str:
    if conf >= 0.90:
        return "very_high"
    if conf >= 0.75:
        return "high"
    if conf >= 0.50:
        return "moderate"
    if conf >= 0.30:
        return "low"
    return "very_low"


def _calibrate_confidence(pathology: str, raw_conf: float) -> Dict[str, Any]:
    pathology_key = (pathology or "").lower()
    # Static conservative calibration priors; can be replaced with learned calibration tables.
    if any(k in pathology_key for k in ["opacity", "pneumonia", "infiltrate"]):
        factor, floor = 0.94, 0.03
    elif any(k in pathology_key for k in ["effusion", "edema", "cardio"]):
        factor, floor = 0.91, 0.04
    elif any(k in pathology_key for k in ["nodule", "mass", "cavity", "lesion"]):
        factor, floor = 0.89, 0.05
    else:
        factor, floor = 0.92, 0.02

    calibrated = max(0.0, min(1.0, raw_conf * factor + floor))
    expected_error = max(0.02, min(0.30, abs(calibrated - raw_conf) + (0.10 if raw_conf < 0.5 else 0.05)))

    if expected_error <= 0.06:
        error_bin = "tight"
    elif expected_error <= 0.12:
        error_bin = "moderate"
    else:
        error_bin = "wide"

    if calibrated >= 0.80:
        risk_band = "critical"
    elif calibrated >= 0.55:
        risk_band = "elevated"
    elif calibrated >= 0.35:
        risk_band = "watch"
    else:
        risk_band = "low"

    return {
        "raw": round(float(raw_conf), 4),
        "calibrated": round(calibrated, 4),
        "expectedError": round(expected_error, 4),
        "errorBin": error_bin,
        "riskBand": risk_band,
    }


def _estimate_uncertainty(analysis: Dict[str, Any], calibration: Dict[str, Any]) -> float:
    raw = float(analysis.get("confidence", 0.0) or 0.0)
    spread = abs(float(calibration.get("raw", raw)) - float(calibration.get("calibrated", raw)))
    missing_bbox_penalty = 0.10
    findings = analysis.get("findings") or []
    if findings and isinstance(findings, list) and findings[0].get("bbox"):
        missing_bbox_penalty = 0.0
    uncertainty = max(0.0, min(1.0, (1.0 - raw) * 0.6 + spread * 1.8 + missing_bbox_penalty))
    return round(uncertainty, 4)


def _estimate_image_quality(image_path: str) -> Optional[float]:
    try:
        import cv2

        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return None
        focus = cv2.Laplacian(img, cv2.CV_64F).var()
        # Normalize to [0,1] for rough quality bucket visualization.
        return round(max(0.0, min(1.0, focus / 1000.0)), 4)
    except Exception:
        return None


def _policy_reasons(case_obj: Optional[Case], patient_context: str, calibrated_conf: float, uncertainty: float) -> List[str]:
    reasons: List[str] = []
    context = f"{patient_context} {(case_obj.complaint if case_obj else '')}".lower()
    for token in POLICY_RULES.get("high_risk_symptoms", []):
        if token in context:
            reasons.append(f"symptom_trigger:{token}")

    if case_obj is not None:
        vitals = POLICY_RULES.get("vital_overrides", {})
        if case_obj.vital_spo2 is not None and float(case_obj.vital_spo2) < vitals.get("spo2_below", 92):
            reasons.append("vital_override:spo2")
        if case_obj.vital_resp is not None and int(case_obj.vital_resp) > vitals.get("resp_above", 28):
            reasons.append("vital_override:resp")
        if case_obj.vital_hr is not None and int(case_obj.vital_hr) > vitals.get("hr_above", 120):
            reasons.append("vital_override:hr")
        if case_obj.vital_temp is not None and float(case_obj.vital_temp) > vitals.get("temp_above", 38.5):
            reasons.append("vital_override:temp")

    if calibrated_conf >= float(POLICY_RULES.get("red_confidence_threshold", 0.80)):
        reasons.append("confidence:red_threshold")
    elif calibrated_conf >= float(POLICY_RULES.get("orange_confidence_threshold", 0.55)):
        reasons.append("confidence:orange_threshold")
    elif calibrated_conf <= float(POLICY_RULES.get("low_confidence_review_threshold", 0.35)):
        reasons.append("confidence:needs_review")

    if uncertainty >= 0.60:
        reasons.append("uncertainty_fail_safe")

    return reasons


def _apply_policy_to_analysis(analysis: Dict[str, Any], case_obj: Optional[Case], patient_context: str) -> Dict[str, Any]:
    calibrated = analysis.get("metadata", {}).get("calibration", {})
    calibrated_conf = float(calibrated.get("calibrated", analysis.get("confidence", 0.0)) or 0.0)
    uncertainty = float(analysis.get("metadata", {}).get("uncertainty", 0.0) or 0.0)
    reasons = _policy_reasons(case_obj, patient_context, calibrated_conf, uncertainty)

    triage_color = analysis.get("triageColor", "green")
    priority = analysis.get("priority", "routine")
    action = "no_change"

    if "confidence:red_threshold" in reasons or any(r.startswith("vital_override") for r in reasons):
        triage_color, priority, action = "red", "immediate", "escalate"
    elif "confidence:orange_threshold" in reasons:
        triage_color, priority, action = "orange", "High Priority", "review"
    elif "confidence:needs_review" in reasons or "uncertainty_fail_safe" in reasons:
        triage_color, priority, action = "yellow", "routine", "needs_review"

    analysis["triageColor"] = triage_color
    analysis["priority"] = priority
    analysis.setdefault("metadata", {})["policy"] = {
        "action": action,
        "reasons": reasons,
        "rulesVersion": "2026.04",
    }
    return analysis


def _needs_dual_consensus(analysis: Dict[str, Any]) -> bool:
    conf = float(analysis.get("confidence", 0.0) or 0.0)
    policy = analysis.get("metadata", {}).get("policy", {})
    reasons = policy.get("reasons", []) if isinstance(policy, dict) else []
    return conf >= float(POLICY_RULES.get("consensus_trigger_confidence", 0.70)) or any(
        str(r).startswith("symptom_trigger") or str(r).startswith("vital_override") for r in reasons
    )


def _merge_consensus(image_path: str, patient_context: str, base_analysis: Dict[str, Any]) -> Dict[str, Any]:
    base_engine = str(base_analysis.get("engine") or "").lower()
    if base_engine == "both":
        return base_analysis

    alt: Optional[Dict[str, Any]] = None
    try:
        if base_engine == "experiment1":
            alt = _run_experiment2(image_path, patient_context)
        elif base_engine == "experiment2":
            alt = _run_experiment1(image_path, patient_context)
    except Exception as ex:
        base_analysis.setdefault("metadata", {})["consensus"] = {
            "state": "alt_failed",
            "reason": str(ex),
        }
        return base_analysis

    if not alt:
        return base_analysis

    base_top = _extract_top_pathology(base_analysis).lower()
    alt_top = _extract_top_pathology(alt).lower()
    agree = base_top == alt_top and base_top != "unknown"
    conf_gap = abs(float(base_analysis.get("confidence", 0.0) or 0.0) - float(alt.get("confidence", 0.0) or 0.0))
    state = "agree" if agree and conf_gap < 0.2 else "disagree"

    base_analysis.setdefault("metadata", {})["consensus"] = {
        "state": state,
        "baseEngine": base_engine,
        "altEngine": alt.get("engine"),
        "baseTop": base_top,
        "altTop": alt_top,
        "confidenceGap": round(conf_gap, 4),
    }

    if state == "disagree":
        policy_block = base_analysis.setdefault("metadata", {}).setdefault("policy", {})
        reasons = policy_block.setdefault("reasons", [])
        reasons.append("consensus_disagreement")
        policy_block["action"] = "escalate"
        base_analysis["triageColor"] = "red"
        base_analysis["priority"] = "immediate"

    return base_analysis


def _record_inference_ledger(
    db: Session,
    run_id: str,
    case_id: Optional[str],
    image_hash: str,
    analysis: Dict[str, Any],
    user_action: str,
    image_quality: Optional[float],
) -> None:
    metadata = analysis.get("metadata", {})
    calibration = metadata.get("calibration", {}) if isinstance(metadata, dict) else {}
    policy = metadata.get("policy", {}) if isinstance(metadata, dict) else {}
    consensus = metadata.get("consensus", {}) if isinstance(metadata, dict) else {}
    timings = metadata.get("timingsMs", {}) if isinstance(metadata, dict) else {}

    row = InferenceLedger(
        run_id=run_id,
        case_id=case_id,
        model_id=str(analysis.get("engine") or active_ai_model),
        pipeline_mode=str(active_ai_model),
        image_hash=image_hash,
        top_pathology=_extract_top_pathology(analysis),
        raw_confidence=float(calibration.get("raw", analysis.get("confidence", 0.0)) or 0.0),
        calibrated_confidence=float(calibration.get("calibrated", analysis.get("confidence", 0.0)) or 0.0),
        confidence_bucket=_confidence_bucket(float(analysis.get("confidence", 0.0) or 0.0)),
        risk_band=str(calibration.get("riskBand") or "low"),
        expected_error_bin=str(calibration.get("errorBin") or "moderate"),
        uncertainty=float(metadata.get("uncertainty", 0.0) or 0.0),
        latency_ms=float((timings or {}).get("total", 0.0) or 0.0),
        image_quality_score=image_quality,
        user_action=user_action,
        policy_action=str(policy.get("action") or "no_change"),
        consensus_state=str(consensus.get("state") or "not_run"),
        status=str(analysis.get("status") or "unknown"),
        details_json=json.dumps({
            "summary": analysis.get("summary"),
            "metadata": metadata,
        }),
    )
    db.add(row)
    db.commit()



def _active_users_count() -> int:
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=ACTIVE_USER_WINDOW_SECONDS)
    stale_hosts = [host for host, ts in REQUEST_ACTIVITY.items() if ts < cutoff]
    for host in stale_hosts:
        REQUEST_ACTIVITY.pop(host, None)
    return len(REQUEST_ACTIVITY)


def _running_processes_snapshot() -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    if psutil is None:
        return [
            {"name": "API Server", "status": "running", "cpu": 0.0, "mem": 0},
            {"name": "Model Engine", "status": "running", "cpu": 0.0, "mem": 0},
        ]

    proc = psutil.Process(os.getpid())
    result.append(
        {
            "name": "API Server",
            "status": "running",
            "cpu": round(proc.cpu_percent(interval=0.0), 1),
            "mem": int(proc.memory_info().rss / (1024 * 1024)),
        }
    )

    if _exp1_detector is not None or _exp2_preprocessor is not None:
        model_status = "running"
    else:
        model_status = "idle"
    result.append(
        {
            "name": "Model Engine",
            "status": model_status,
            "cpu": round(proc.cpu_percent(interval=0.0), 1),
            "mem": int(proc.memory_info().rss / (1024 * 1024)),
        }
    )

    result.append(
        {
            "name": f"Active Pipeline ({active_ai_model})",
            "status": "running" if active_ai_model != "none" else "idle",
            "cpu": 0.0,
            "mem": 0,
        }
    )
    return result


def _pipeline_stream_snapshot(db: Session) -> List[str]:
    recent_cases = (
        db.query(Case)
        .filter(Case.is_deleted == 0)
        .order_by(Case.updated_at.desc())
        .limit(5)
        .all()
    )

    if not recent_cases:
        return [
            f"Pipeline mode: {active_ai_model}",
            "No case activity yet",
            "Awaiting first payload",
        ]

    events: List[str] = [f"Pipeline mode: {active_ai_model}"]
    for case_obj in recent_cases:
        pid = case_obj.patient_id or "unknown"
        status = case_obj.ai_status or "ready"
        conf = float(case_obj.confidence or 0.0)
        if status == "analyzing":
            events.append(f"{pid}: Inference running")
        elif status == "complete":
            events.append(f"{pid}: Completed ({conf:.2f})")
        elif status == "escalated":
            events.append(f"{pid}: Escalated to specialist")
        else:
            events.append(f"{pid}: Queued ({status})")

    return events


def _resolve_image_path(image_path: Optional[str]) -> Optional[str]:
    if not image_path:
        return None

    if os.path.isabs(image_path):
        return image_path

    normalized = image_path.lstrip("/")
    return os.path.join(BASE_DIR, normalized)


def _priority_from_confidence(conf: float) -> tuple[str, str]:
    if conf >= 0.75:
        return "red", "urgent"
    if conf >= 0.50:
        return "orange", "High Priority"
    if conf >= 0.30:
        return "yellow", "routine"
    return "green", "routine"


_REPORT_SECTION_ALIASES: Dict[str, List[str]] = {
    "key_findings": [
        "KEY FINDINGS",
        "TOP FINDING",
        "MEDICAL FINDINGS",
        "FINDINGS",
        "IMPRESSION",
        "SUMMARY",
        "CONFIRMATION & SEVERITY",
        "CONFIRMATION AND SEVERITY",
    ],
    "differential_diagnosis": [
        "DIFFERENTIAL DIAGNOSTICS",
        "DIFFERENTIAL DIAGNOSIS",
        "DIFFERENTIALS",
        "DIFFERENTIAL",
    ],
    "future_steps": [
        "FUTURE STEPS/PRECAUTIONS",
        "FUTURE STEPS AND PRECAUTIONS",
        "FUTURE STEPS",
        "NEXT STEPS",
        "RECOMMENDED STEPS",
        "RECOMMENDATIONS",
        "PLAN",
        "SAFETY & RISKS",
        "SAFETY AND RISKS",
    ],
}

_ALL_REPORT_HEADERS = sorted(
    {
        alias
        for aliases in _REPORT_SECTION_ALIASES.values()
        for alias in aliases
    },
    key=len,
    reverse=True,
)


def _clean_optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).replace("\r\n", "\n").strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip(" \n\t:-")
    return text or None


def _extract_report_section(report_text: Optional[str], aliases: List[str]) -> Optional[str]:
    text = _clean_optional_text(report_text)
    if not text:
        return None

    escaped_aliases = "|".join(re.escape(alias) for alias in sorted(set(aliases), key=len, reverse=True))
    escaped_headers = "|".join(re.escape(header) for header in _ALL_REPORT_HEADERS)

    block_pattern = re.compile(
        rf"(?is)(?:^|\n)\s*(?:[#>*-]\s*)?(?:{escaped_aliases})\s*:?\s*(.*?)(?=(?:\n\s*(?:[#>*-]\s*)?(?:{escaped_headers})\s*:?)|\Z)"
    )
    match = block_pattern.search(text)
    if not match:
        inline_pattern = re.compile(
            rf"(?is)(?:{escaped_aliases})\s*:?\s*(.*?)(?=(?:{escaped_headers})\s*:?|\Z)"
        )
        match = inline_pattern.search(text)

    if not match:
        return None

    section_value = _clean_optional_text(match.group(1))
    if not section_value:
        return None

    if section_value.lower().startswith("none"):
        return None
    return section_value


def _default_key_findings(top_pathology: str, confidence: float, status: str) -> str:
    if status in {"normal", "disabled"} or not top_pathology or top_pathology == "unknown":
        return "No focal acute cardiopulmonary abnormality is identified on the current AI-assisted review."

    confidence_pct = round(confidence * 100.0, 1)
    return (
        f"Radiographic pattern is most consistent with {top_pathology}. "
        f"Estimated model confidence is {confidence_pct:.1f}%."
    )


def _default_differential(top_pathology: str, status: str) -> str:
    if status in {"normal", "disabled"} or not top_pathology or top_pathology == "unknown":
        return (
            "No high-confidence acute radiographic differential is identified on imaging alone; "
            "recommend clinicoradiologic correlation."
        )
    return (
        f"Primary: {top_pathology}. "
        "Secondary considerations include infectious, inflammatory, and cardiogenic/edematous etiologies depending on symptom profile and laboratory correlation."
    )


def _default_future_steps(status: str, confidence: float) -> str:
    if status in {"normal", "disabled"}:
        return (
            "- Correlate with clinical history, physical examination, and baseline laboratory profile.\n"
            "- Repeat chest imaging if respiratory symptoms persist, worsen, or fail to resolve.\n"
            "- Escalate for urgent specialist review if red-flag deterioration occurs (hypoxia, chest pain, progressive dyspnea)."
        )

    urgency_line = "- Arrange urgent specialist review and close monitoring." if confidence >= 0.55 else "- Perform short-interval clinical follow-up with repeat imaging."
    return (
        "- Correlate imaging findings with physical examination, vital-sign trend, and laboratory profile.\n"
        f"{urgency_line}\n"
        "- Provide documented safety-net precautions (worsening dyspnea, chest pain, hypoxia) with clear return-to-care instructions."
    )


def _medicalize_key_findings(section_text: Optional[str], top_pathology: str, confidence: float, status: str) -> str:
    text = _clean_optional_text(section_text)
    if not text:
        return _default_key_findings(top_pathology, confidence, status)

    text = re.sub(r"\bgenerated\s+using\b.*$", "", text, flags=re.IGNORECASE).strip(" .")
    text = re.sub(r"^top\s*finding\s*:\s*", "", text, flags=re.IGNORECASE).strip(" .")
    text = re.sub(r"\((0?\.\d+)\)", "", text).strip(" .")

    if not text:
        return _default_key_findings(top_pathology, confidence, status)

    confidence_pct = round(confidence * 100.0, 1)
    if "confidence" not in text.lower() and status not in {"normal", "disabled"}:
        return f"Radiographic pattern is most consistent with {text}. Estimated model confidence is {confidence_pct:.1f}%."
    return text


def _normalize_top_pathology_label(top_pathology: str) -> str:
    text = _clean_optional_text(top_pathology) or "unknown"
    text = re.sub(r"^(top\s+finding\s*:\s*)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^(exp\d\s*:\s*)", "", text, flags=re.IGNORECASE)
    text = text.strip(" .")
    return text or "unknown"


def _compose_structured_report(
    key_findings: str,
    differential_diagnosis: str,
    future_steps: str,
    raw_report_text: Optional[str],
) -> str:
    structured = (
        "KEY FINDINGS:\n"
        f"{key_findings}\n\n"
        "DIFFERENTIAL DIAGNOSTICS:\n"
        f"{differential_diagnosis}\n\n"
        "FUTURE STEPS/PRECAUTIONS:\n"
        f"{future_steps}"
    )

    clean_raw = _clean_optional_text(raw_report_text)
    if not clean_raw:
        return structured

    uppercase_raw = clean_raw.upper()
    has_structured_headers = (
        "KEY FINDINGS" in uppercase_raw
        and "DIFFERENTIAL" in uppercase_raw
        and ("FUTURE STEPS" in uppercase_raw or "NEXT STEPS" in uppercase_raw)
    )
    if has_structured_headers:
        return clean_raw

    return f"{structured}\n\nMODEL NARRATIVE:\n{clean_raw}"


def _normalize_analysis_report_sections(analysis: Dict[str, Any]) -> Dict[str, Any]:
    status = str(analysis.get("status") or "")
    if status == "disabled":
        return analysis

    top_pathology = _normalize_top_pathology_label(_extract_top_pathology(analysis))
    confidence = float(analysis.get("confidence", 0.0) or 0.0)
    raw_report = _clean_optional_text(analysis.get("aiDraftReport"))

    key_findings = _extract_report_section(raw_report, _REPORT_SECTION_ALIASES["key_findings"])
    key_findings = _medicalize_key_findings(key_findings, top_pathology, confidence, status)

    differential_diagnosis = _clean_optional_text(analysis.get("differentialDiagnosis"))
    if not differential_diagnosis:
        differential_diagnosis = _extract_report_section(raw_report, _REPORT_SECTION_ALIASES["differential_diagnosis"])
    if not differential_diagnosis:
        differential_diagnosis = _default_differential(top_pathology, status)

    future_steps = _clean_optional_text(analysis.get("recommendedSteps"))
    if not future_steps:
        future_steps = _extract_report_section(raw_report, _REPORT_SECTION_ALIASES["future_steps"])
    if not future_steps:
        future_steps = _default_future_steps(status, confidence)

    analysis["differentialDiagnosis"] = differential_diagnosis
    analysis["recommendedSteps"] = future_steps
    analysis["aiDraftReport"] = _compose_structured_report(
        key_findings=key_findings,
        differential_diagnosis=differential_diagnosis,
        future_steps=future_steps,
        raw_report_text=raw_report,
    )

    metadata = analysis.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        analysis["metadata"] = metadata
    metadata["reportSections"] = {
        "keyFindings": key_findings,
        "differentialDiagnostics": differential_diagnosis,
        "futureStepsPrecautions": future_steps,
    }

    return analysis


def _write_temp_png_from_array(image_array) -> str:
    import cv2

    with tempfile.NamedTemporaryFile(prefix="hsil_crop_", suffix=".png", delete=False) as tmp:
        temp_path = tmp.name

    ok = cv2.imwrite(temp_path, image_array)
    if not ok:
        try:
            os.remove(temp_path)
        except Exception:
            pass
        raise ValueError("Failed to create temporary crop image for detector")

    return temp_path


def _get_exp2_backend_label() -> str:
    global _exp2_backend_label

    if _exp2_backend_label is not None:
        return _exp2_backend_label

    try:
        router_module = _load_module_from_file(
            "hsil_exp2_router",
            os.path.join(EXP2_ENGINE_DIR, "foveal_engine", "router.py"),
        )
        middleware_router = getattr(router_module, "MiddlewareRouter")
        _exp2_backend_label = str(middleware_router.get_inference_backend())
    except Exception as ex:
        _exp2_backend_label = f"unknown ({ex})"

    return _exp2_backend_label


def _get_exp1_components():
    global _exp1_detector, _exp1_localizer

    if _exp1_detector is not None and _exp1_localizer is not None:
        return _exp1_detector, _exp1_localizer

    # Bootstrap XRV cache layout expected by detector.py
    xrv_root = os.path.join(BASE_DIR, "models", "xrv")
    xrv_models_data = os.path.join(xrv_root, "models_data")
    os.makedirs(xrv_models_data, exist_ok=True)

    if not any(name.endswith(".pt") for name in os.listdir(xrv_models_data)):
        candidate_paths = [
            os.path.join(xrv_root, "nih-pc-chex-mimic_ch-google-openi-kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"),
            os.path.expanduser("~/.torchxrayvision/models_data/nih-pc-chex-mimic_ch-google-openi-kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt"),
        ]
        for src in candidate_paths:
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(xrv_models_data, os.path.basename(src)))
                break

    detector_module = _load_module_from_file("hsil_exp1_detector", os.path.join(EXP1_CORE_DIR, "detector.py"))
    localizer_module = _load_module_from_file("hsil_exp1_localizer", os.path.join(EXP1_CORE_DIR, "localizer.py"))
    XRayDetector = getattr(detector_module, "XRayDetector")
    XRayLocalizer = getattr(localizer_module, "XRayLocalizer")

    _exp1_detector = XRayDetector()
    _exp1_localizer = XRayLocalizer(_exp1_detector.model)
    return _exp1_detector, _exp1_localizer


def _is_exp1_analyzer_enabled() -> bool:
    flag = os.getenv("HSIL_ENABLE_EXP1_ANALYZER", "auto").strip().lower()
    if flag in {"1", "true", "yes", "on"}:
        return True
    if flag in {"0", "false", "no", "off"}:
        return False

    # Auto mode: keep heavy VLM analyzer for CUDA systems by default.
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def _get_exp1_analyzer_optional():
    global _exp1_analyzer, _exp1_analyzer_error

    if _exp1_analyzer is not None:
        return _exp1_analyzer

    if _exp1_analyzer_error is not None:
        return None

    if not _is_exp1_analyzer_enabled():
        _exp1_analyzer_error = (
            "disabled by default on non-CUDA devices to avoid excessive memory/swap usage "
            "(set HSIL_ENABLE_EXP1_ANALYZER=1 to force enable)"
        )
        return None

    try:
        analyzer_module = _load_module_from_file("hsil_exp1_analyzer", os.path.join(EXP1_CORE_DIR, "analyzer.py"))
        CheXagentAnalyzer = getattr(analyzer_module, "CheXagentAnalyzer")
        _exp1_analyzer = CheXagentAnalyzer()
        return _exp1_analyzer
    except Exception as ex:
        _exp1_analyzer_error = str(ex)
        print(f"CheXagent unavailable, continuing with detector/localizer only: {_exp1_analyzer_error}")
        return None


def _run_experiment1(image_path: str, patient_context: str = "") -> Dict[str, Any]:
    with PIPELINE_LOCK:
        return _run_experiment1_locked(image_path, patient_context)


def _run_experiment1_locked(image_path: str, patient_context: str = "") -> Dict[str, Any]:
    start_ts = time.perf_counter()

    detector, localizer = _get_exp1_components()

    detect_start = time.perf_counter()
    findings, img_tensor = detector.detect(image_path, threshold=0.3)
    detect_ms = (time.perf_counter() - detect_start) * 1000.0

    if not findings:
        total_ms = (time.perf_counter() - start_ts) * 1000.0
        return {
            "engine": "experiment1",
            "status": "normal",
            "findings": [],
            "summary": "No significant abnormalities detected.",
            "confidence": 0.0,
            "triageColor": "green",
            "priority": "routine",
            "aiDraftReport": "No significant findings by RadFlow detector.",
            "differentialDiagnosis": None,
            "recommendedSteps": None,
            "metadata": {
                "detector": "torchxrayvision:densenet121-res224-all",
                "inference_backend": f"torchxrayvision:{detector.device}",
                "detector_threshold": 0.3,
                "analyzer": "not_required",
                "timingsMs": {
                    "total": round(total_ms, 1),
                    "detection": round(detect_ms, 1),
                    "localization": 0.0,
                    "analysis": 0.0,
                },
            },
        }

    disease, confidence = list(findings.items())[0]
    localize_ms = 0.0
    crops: List[Dict[str, Any]] = []
    try:
        disease_idx = detector.diseases.index(disease)
        localize_start = time.perf_counter()
        heatmap = localizer.get_heatmap(img_tensor, disease_idx)
        bboxes = localizer.heatmap_to_bboxes(heatmap)
        crops = localizer.crop_regions(image_path, bboxes)
        localize_ms = (time.perf_counter() - localize_start) * 1000.0
    except Exception as ex:
        # Keep pipeline available even when GradCAM/localizer has device issues.
        _write_event("localization_fallback", {"engine": "experiment1", "error": str(ex)})
        crops = []

    finding_items: List[Dict[str, Any]] = []
    for crop in crops[:2]:
        bbox = crop["bbox"]
        finding_items.append(
            {
                "disease": disease,
                "confidence": float(confidence),
                "bbox": [int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])],
                "report": None,
                "source_engine": "experiment1",
            }
        )

    if not finding_items:
        finding_items.append(
            {
                "disease": disease,
                "confidence": float(confidence),
                "bbox": None,
                "report": None,
                "source_engine": "experiment1",
            }
        )

    analyzer = _get_exp1_analyzer_optional()
    analyzer_state = f"unavailable: {_exp1_analyzer_error}" if _exp1_analyzer_error else "unavailable"
    analysis_ms = 0.0
    
    differential_diagnosis = None
    recommended_steps = None

    if analyzer is not None and crops:
        try:
            analysis_start = time.perf_counter()
            analysis_text = analyzer.analyze(
                crop_img=crops[0]["image"],
                disease_hint=disease,
                patient_context=patient_context,
                rag_context="",
            )
            analysis_ms = (time.perf_counter() - analysis_start) * 1000.0
            
            ddx = _extract_report_section(analysis_text, _REPORT_SECTION_ALIASES["differential_diagnosis"])
            if ddx:
                differential_diagnosis = ddx

            steps = _extract_report_section(analysis_text, _REPORT_SECTION_ALIASES["future_steps"])
            if steps:
                recommended_steps = steps

            finding_items[0]["report"] = analysis_text
            analyzer_state = "loaded"
        except Exception as ex:
            analyzer_state = f"error: {ex}"

    if finding_items[0].get("report") is None:
        narrative_start = time.perf_counter()
        gemma_text = _gemma_narrative_report(
            crops[0]["image"] if crops else None,
            image_path,
            disease,
            float(confidence),
            patient_context,
        )
        if gemma_text:
            analysis_ms = (time.perf_counter() - narrative_start) * 1000.0
            differential_diagnosis = (
                _extract_report_section(gemma_text, _REPORT_SECTION_ALIASES["differential_diagnosis"])
                or differential_diagnosis
            )
            recommended_steps = (
                _extract_report_section(gemma_text, _REPORT_SECTION_ALIASES["future_steps"])
                or recommended_steps
            )
            finding_items[0]["report"] = gemma_text
            analyzer_state = f"local_llm:{_get_local_llm_model()}"

    triage_color, priority = _priority_from_confidence(float(confidence))
    report_text = finding_items[0].get("report") or (
        f"Top finding: {disease} ({float(confidence):.2f}). "
        "Generated using RadFlow detector/localizer."
    )

    total_ms = (time.perf_counter() - start_ts) * 1000.0

    return {
        "engine": "experiment1",
        "status": "success",
        "findings": finding_items,
        "summary": f"Top finding: {disease}",
        "confidence": float(confidence),
        "triageColor": triage_color,
        "priority": priority,
        "aiDraftReport": report_text,
        "differentialDiagnosis": differential_diagnosis,
        "recommendedSteps": recommended_steps,
        "metadata": {
            "detector": "torchxrayvision:densenet121-res224-all",
            "inference_backend": f"torchxrayvision:{detector.device}",
            "detector_threshold": 0.3,
            "analyzer": analyzer_state,
            "timingsMs": {
                "total": round(total_ms, 1),
                "detection": round(detect_ms, 1),
                "localization": round(localize_ms, 1),
                "analysis": round(analysis_ms, 1),
            },
        },
    }


def _get_exp2_preprocessor():
    global _exp2_preprocessor
    if _exp2_preprocessor is not None:
        return _exp2_preprocessor

    vision_module = _load_module_from_file(
        "hsil_exp2_vision_hack",
        os.path.join(EXP2_ENGINE_DIR, "foveal_engine", "vision_hack.py"),
    )
    FovealPreprocessor = getattr(vision_module, "FovealPreprocessor")

    _exp2_preprocessor = FovealPreprocessor()
    return _exp2_preprocessor


def _load_module_from_file(module_name: str, file_path: str):
    if module_name in sys.modules:
        return sys.modules[module_name]

    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load module spec for {module_name} from {file_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _run_experiment2(image_path: str, patient_context: str = "") -> Dict[str, Any]:
    with PIPELINE_LOCK:
        return _run_experiment2_locked(image_path, patient_context)


def _run_experiment2_locked(image_path: str, patient_context: str = "") -> Dict[str, Any]:
    import cv2

    start_ts = time.perf_counter()
    preprocessor = _get_exp2_preprocessor()

    preprocess_start = time.perf_counter()
    results = preprocessor.process(image_path)
    preprocess_ms = (time.perf_counter() - preprocess_start) * 1000.0

    bbox = results["bbox"]
    start_x, start_y, end_x, end_y = [int(v) for v in bbox]
    crop_img = results["foveal_crop"]

    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Unable to load image for foveal preprocessing")

    orig_h, orig_w = img.shape
    processed_pixels = (224 * 224) + (crop_img.shape[0] * crop_img.shape[1])
    compression_ratio = max(0.0, 1.0 - (processed_pixels / float(orig_h * orig_w)))

    detector, localizer = _get_exp1_components()

    detect_start = time.perf_counter()
    crop_temp_path = _write_temp_png_from_array(crop_img)
    try:
        crop_findings, crop_tensor = detector.detect(crop_temp_path, threshold=0.3)
    finally:
        try:
            os.remove(crop_temp_path)
        except Exception:
            pass
    detect_ms = (time.perf_counter() - detect_start) * 1000.0

    source = "foveal_crop"
    disease = "No significant abnormalities"
    confidence = 0.0
    resolved_bbox = [start_x, start_y, end_x, end_y]
    localize_ms = 0.0
    detail_crop = None

    if crop_findings:
        disease, confidence = list(crop_findings.items())[0]
        try:
            localize_start = time.perf_counter()
            disease_idx = detector.diseases.index(disease)
            heatmap = localizer.get_heatmap(crop_tensor, disease_idx)
            crop_bboxes = localizer.heatmap_to_bboxes(heatmap)
            if crop_bboxes:
                x, y, w, h = crop_bboxes[0]
                scale_x = max(1.0, crop_img.shape[1] / 224.0)
                scale_y = max(1.0, crop_img.shape[0] / 224.0)
                abs_x1 = start_x + int(x * scale_x)
                abs_y1 = start_y + int(y * scale_y)
                abs_x2 = start_x + int((x + w) * scale_x)
                abs_y2 = start_y + int((y + h) * scale_y)
                resolved_bbox = [abs_x1, abs_y1, abs_x2, abs_y2]
            localize_ms = (time.perf_counter() - localize_start) * 1000.0
        except Exception:
            # Keep the foveal bbox as safe fallback if GradCAM localization fails on crop.
            pass
    else:
        full_findings, img_tensor = detector.detect(image_path, threshold=0.3)
        source = "full_image_fallback"
        if full_findings:
            disease, confidence = list(full_findings.items())[0]
            try:
                localize_start = time.perf_counter()
                disease_idx = detector.diseases.index(disease)
                heatmap = localizer.get_heatmap(img_tensor, disease_idx)
                full_bboxes = localizer.heatmap_to_bboxes(heatmap)
                detail_crops = localizer.crop_regions(image_path, full_bboxes)
                if detail_crops:
                    detail_crop = detail_crops[0]["image"]
                    box = detail_crops[0]["bbox"]
                    resolved_bbox = [int(box[0]), int(box[1]), int(box[2]), int(box[3])]
                localize_ms = (time.perf_counter() - localize_start) * 1000.0
            except Exception:
                pass

    analyzer = _get_exp1_analyzer_optional()
    analyzer_state = f"unavailable: {_exp1_analyzer_error}" if _exp1_analyzer_error else "unavailable"
    analysis_ms = 0.0

    report = (
        "Foveal preprocessing complete. "
        f"Primary region at bbox ({start_x}, {start_y}, {end_x}, {end_y}). "
        f"Approx token reduction: {compression_ratio * 100:.1f}%."
    )
    
    differential_diagnosis = None
    recommended_steps = None

    if confidence > 0:
        report = (
            f"Foveal pipeline detected {disease} ({float(confidence):.2f}) using {source}. "
            f"Primary region at bbox ({resolved_bbox[0]}, {resolved_bbox[1]}, {resolved_bbox[2]}, {resolved_bbox[3]}). "
            f"Approx token reduction: {compression_ratio * 100:.1f}%."
        )

    if analyzer is not None and confidence > 0:
        try:
            analysis_start = time.perf_counter()
            analyzer_input = detail_crop
            if analyzer_input is None:
                analyzer_input = cv2.cvtColor(crop_img, cv2.COLOR_GRAY2BGR)
            analyzer_text = analyzer.analyze(
                crop_img=analyzer_input,
                disease_hint=disease,
                patient_context=patient_context,
                rag_context="Foveal preprocessing + detector consensus",
            )
            analysis_ms = (time.perf_counter() - analysis_start) * 1000.0
            
            ddx = _extract_report_section(analyzer_text, _REPORT_SECTION_ALIASES["differential_diagnosis"])
            if ddx:
                differential_diagnosis = ddx

            steps = _extract_report_section(analyzer_text, _REPORT_SECTION_ALIASES["future_steps"])
            if steps:
                recommended_steps = steps

            report = analyzer_text
            analyzer_state = "loaded"
        except Exception as ex:
            analyzer_state = f"error: {ex}"

    if analyzer_state != "loaded" and confidence > 0:
        narrative_start = time.perf_counter()
        narrative_input = detail_crop
        if narrative_input is None:
            narrative_input = cv2.cvtColor(crop_img, cv2.COLOR_GRAY2BGR)
        gemma_text = _gemma_narrative_report(
            narrative_input,
            image_path,
            disease,
            float(confidence),
            patient_context,
        )
        if gemma_text:
            analysis_ms = (time.perf_counter() - narrative_start) * 1000.0
            differential_diagnosis = (
                _extract_report_section(gemma_text, _REPORT_SECTION_ALIASES["differential_diagnosis"])
                or differential_diagnosis
            )
            recommended_steps = (
                _extract_report_section(gemma_text, _REPORT_SECTION_ALIASES["future_steps"])
                or recommended_steps
            )
            report = gemma_text
            analyzer_state = f"local_llm:{_get_local_llm_model()}"

    triage_color, priority = _priority_from_confidence(float(confidence))
    total_ms = (time.perf_counter() - start_ts) * 1000.0

    findings_payload: List[Dict[str, Any]] = []
    if confidence > 0:
        findings_payload.append(
            {
                "disease": disease,
                "confidence": float(confidence),
                "bbox": [int(resolved_bbox[0]), int(resolved_bbox[1]), int(resolved_bbox[2]), int(resolved_bbox[3])],
                "report": report,
                "source_engine": "experiment2",
            }
        )

    summary = "No significant abnormalities detected in foveal pipeline."
    status = "normal"
    if confidence > 0:
        summary = f"Top finding: {disease}"
        status = "success"

    return {
        "engine": "experiment2",
        "status": status,
        "findings": findings_payload,
        "summary": summary,
        "confidence": float(confidence),
        "triageColor": triage_color,
        "priority": priority,
        "aiDraftReport": report,
        "differentialDiagnosis": differential_diagnosis,
        "recommendedSteps": recommended_steps,
        "metadata": {
            "compression_ratio": compression_ratio,
            "inference_backend": f"torchxrayvision:{detector.device}",
            "router_recommendation": _get_exp2_backend_label(),
            "detector": "torchxrayvision:densenet121-res224-all",
            "detector_threshold": 0.3,
            "analyzer": analyzer_state,
            "source": source,
            "timingsMs": {
                "total": round(total_ms, 1),
                "preprocess": round(preprocess_ms, 1),
                "detection": round(detect_ms, 1),
                "localization": round(localize_ms, 1),
                "analysis": round(analysis_ms, 1),
            },
        },
    }


def _run_active_pipeline(image_path: str, patient_context: str = "") -> Dict[str, Any]:
    mode = (active_ai_model or "experiment1").lower()

    if mode == "none":
        return {
            "engine": "none",
            "status": "disabled",
            "findings": [],
            "summary": "AI analysis disabled in settings.",
            "confidence": 0.0,
            "triageColor": "green",
            "priority": "routine",
            "aiDraftReport": "AI is disabled by system settings.",
            "metadata": {},
        }

    if mode == "experiment2":
        return _normalize_analysis_report_sections(_run_experiment2(image_path, patient_context))

    if mode == "both":
        exp2 = _run_experiment2(image_path, patient_context)
        try:
            exp1 = _run_experiment1(image_path, patient_context)
            best_conf = max(float(exp1.get("confidence", 0)), float(exp2.get("confidence", 0)))
            triage_color, priority = _priority_from_confidence(best_conf)
            combined = {
                "engine": "both",
                "status": "success",
                "findings": exp1.get("findings", []) + exp2.get("findings", []),
                "summary": f"Exp1: {exp1.get('summary', 'n/a')} | Exp2: {exp2.get('summary', 'n/a')}",
                "confidence": best_conf,
                "triageColor": triage_color,
                "priority": priority,
                "aiDraftReport": f"{exp1.get('aiDraftReport', '')}\n\n{exp2.get('aiDraftReport', '')}".strip(),
                "differentialDiagnosis": exp1.get("differentialDiagnosis") or exp2.get("differentialDiagnosis"),
                "recommendedSteps": exp1.get("recommendedSteps") or exp2.get("recommendedSteps"),
                "metadata": {"exp1": exp1.get("metadata", {}), "exp2": exp2.get("metadata", {})},
            }
            return _normalize_analysis_report_sections(combined)
        except Exception as ex:
            exp2["metadata"]["exp1_error"] = str(ex)
            return _normalize_analysis_report_sections(exp2)

    # Default: experiment1
    return _normalize_analysis_report_sections(_run_experiment1(image_path, patient_context))


def _enrich_analysis(
    image_path: str,
    analysis: Dict[str, Any],
    case_obj: Optional[Case],
    patient_context: str,
    force_consensus: bool = False,
) -> Dict[str, Any]:
    top_pathology = _extract_top_pathology(analysis)
    raw_conf = float(analysis.get("confidence", 0.0) or 0.0)
    calibration = _calibrate_confidence(top_pathology, raw_conf)

    analysis.setdefault("metadata", {})["calibration"] = calibration
    analysis.setdefault("metadata", {})["confidenceBucket"] = _confidence_bucket(raw_conf)
    analysis.setdefault("metadata", {})["imageQuality"] = _estimate_image_quality(image_path)
    analysis.setdefault("metadata", {})["uncertainty"] = _estimate_uncertainty(analysis, calibration)

    _apply_policy_to_analysis(analysis, case_obj, patient_context)

    if force_consensus or _needs_dual_consensus(analysis):
        analysis = _merge_consensus(image_path, patient_context, analysis)

    return analysis


def _ensure_escalation(case_obj: Case, analysis: Dict[str, Any], db: Session) -> None:
    policy = analysis.get("metadata", {}).get("policy", {})
    action = str(policy.get("action") or "")
    if action not in {"escalate", "needs_review"}:
        return

    existing = (
        db.query(Escalation)
        .filter(Escalation.patient_id == case_obj.patient_id, Escalation.is_deleted == 0)
        .first()
    )

    reason_lines = policy.get("reasons") if isinstance(policy.get("reasons"), list) else []
    reason = "; ".join(str(r) for r in reason_lines)[:400]
    if not reason:
        reason = "Policy-triggered review"

    if existing is None:
        db.add(
            Escalation(
                patient_id=case_obj.patient_id,
                name=case_obj.name,
                age=case_obj.age,
                sex=case_obj.sex,
                reason_for_escalation=reason,
                priority="immediate" if action == "escalate" else "urgent",
                ai_triage="red" if action == "escalate" else "yellow",
                confidence=float(analysis.get("confidence", 0.0) or 0.0),
                time_waiting="0h 0m",
                status="awaiting",
            )
        )
        db.add(
            EscalationEvent(
                patient_id=case_obj.patient_id,
                event_type="auto_created",
                old_status=None,
                new_status="awaiting",
                reason=reason,
                actor="policy_engine",
            )
        )
    else:
        prev_status = existing.status
        existing.status = "awaiting"
        existing.reason_for_escalation = reason
        existing.confidence = float(analysis.get("confidence", 0.0) or 0.0)
        db.add(
            EscalationEvent(
                patient_id=case_obj.patient_id,
                event_type="policy_update",
                old_status=prev_status,
                new_status="awaiting",
                reason=reason,
                actor="policy_engine",
            )
        )



def _apply_analysis_to_case(db_case: Case, analysis: Dict[str, Any], db: Session) -> None:
    calibrated = (
        analysis.get("metadata", {})
        .get("calibration", {})
        .get("calibrated", analysis.get("confidence", 0.0))
    )
    db_case.confidence = float(calibrated or 0.0)
    db_case.triage_color = analysis.get("triageColor", "green")
    db_case.priority = analysis.get("priority", "routine")
    db_case.ai_draft_report = analysis.get("aiDraftReport")
    
    if "differentialDiagnosis" in analysis:
        db_case.differential_diagnosis = analysis.get("differentialDiagnosis")
    if "recommendedSteps" in analysis:
        db_case.recommended_steps = analysis.get("recommendedSteps")
        
    db_case.ai_status = "complete" if analysis.get("status") in ("success", "normal") else "ready"

    # Replace findings for this case with latest analysis output
    db.query(Finding).filter(Finding.case_id == db_case.patient_id).delete()
    for f in analysis.get("findings", []):
        bbox = f.get("bbox") or [None, None, None, None]
        db.add(
            Finding(
                case_id=db_case.patient_id,
                disease=f.get("disease", "unknown"),
                confidence=float(f.get("confidence", 0.0) or 0.0),
                bbox_x1=bbox[0],
                bbox_y1=bbox[1],
                bbox_x2=bbox[2],
                bbox_y2=bbox[3],
                report=f.get("report"),
                source_engine=f.get("source_engine"),
            )
        )

    _ensure_escalation(db_case, analysis, db)
    db.commit()


def _bootstrap_legacy_finding_if_possible(db_case: Case, db: Session) -> bool:
    confidence = float(db_case.confidence or 0.0)

    disease_name = (db_case.complaint or "legacy finding").strip()
    if not disease_name:
        disease_name = "legacy finding"
    disease_name = disease_name[:100]

    db.add(
        Finding(
            case_id=db_case.patient_id,
            disease=disease_name,
            confidence=confidence,
            bbox_x1=None,
            bbox_y1=None,
            bbox_x2=None,
            bbox_y2=None,
            report=db_case.ai_draft_report,
            source_engine=None,
        )
    )
    db.commit()
    return True


def _ensure_findings_for_case(patient_id: str, db: Session) -> List[Finding]:
    existing = db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 0).all()
    if existing:
        return existing

    db_case = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 0).order_by(Case.id.desc()).first()
    if not db_case:
        return []

    # An analysis job is already in flight; let the client keep polling
    # instead of synthesizing a placeholder finding it would then trust.
    if db_case.ai_status == "analyzing":
        return []

    resolved_path = _resolve_image_path(db_case.image_path)
    if resolved_path and os.path.exists(resolved_path) and active_ai_model != "none":
        # Reads must stay cheap: queue the heavy backfill instead of running
        # the model pipeline inside a GET request.
        patient_context = f"{db_case.age}{db_case.sex}, complaint: {db_case.complaint}"
        db_case.ai_status = "analyzing"
        db.commit()
        _enqueue_analysis_job(
            db,
            image_path=resolved_path,
            patient_id=db_case.patient_id,
            patient_context=patient_context,
            user_action="legacy_backfill",
        )
        return []

    _bootstrap_legacy_finding_if_possible(db_case, db)
    return db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 0).all()

# Pydantic Schemas
class CaseBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    patient_id: str = Field(..., alias="patientId")
    name: str
    age: int
    sex: str
    complaint: str
    study_type: str = Field("Chest X-Ray (PA)", alias="studyType")
    ai_status: str = Field("ready", alias="aiStatus")
    triage_color: str = Field("green", alias="triageColor")
    confidence: float = 0
    priority: Optional[str] = None
    image_path: Optional[str] = Field(None, alias="imagePath")
    vital_temp: Optional[float] = Field(None, alias="vitalTemp")
    vital_hr: Optional[int] = Field(None, alias="vitalHr")
    vital_bp: Optional[str] = Field(None, alias="vitalBp")
    vital_resp: Optional[int] = Field(None, alias="vitalResp")
    vital_spo2: Optional[float] = Field(None, alias="vitalSpo2")
    vital_weight: Optional[float] = Field(None, alias="vitalWeight")
    risk_factors: Optional[str] = Field(None, alias="riskFactors")
    clinical_notes: Optional[str] = Field(None, alias="clinicalNotes")
    differential_diagnosis: Optional[str] = Field(None, alias="differentialDiagnosis")
    recommended_steps: Optional[str] = Field(None, alias="recommendedSteps")
    ai_draft_report: Optional[str] = Field(None, alias="aiDraftReport")
    is_archived: int = Field(0, alias="isArchived")
class CaseCreateSchema(CaseBase):
    pass

class CaseSchema(CaseBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    time_received: datetime
    created_at: datetime
    updated_at: datetime

    # The frontend expects camelCase for some attributes (e.g. patientId instead of patient_id)
    # We will alias them in the schema or handle it in the TS client. Actually `CONVERSATION_HISTORY.md`
    # said `patientId`, `studyType`, etc. So we redefine the schema to match frontend if needed,
    # or handle it in TS. Rebuild guide says:
    patientId: str
    studyType: str
    timeReceived: str
    aiStatus: str
    triageColor: str
    imagePath: Optional[str] = None

    @classmethod
    def from_orm(cls, obj: Any):
        # We manually map if needed, or use aliases. Let's use Pydantic Alias for simplicity.
        return super().from_orm(obj)

class CaseFrontendSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    patientId: str
    name: str
    age: int
    sex: str
    complaint: str
    studyType: str
    timeReceived: str
    aiStatus: str
    triageColor: str
    confidence: float
    priority: Optional[str] = None
    imagePath: Optional[str] = None
    vitalTemp: Optional[float] = None
    vitalHr: Optional[int] = None
    vitalBp: Optional[str] = None
    vitalResp: Optional[int] = None
    vitalSpo2: Optional[float] = None
    vitalWeight: Optional[float] = None
    riskFactors: Optional[str] = None
    clinicalNotes: Optional[str] = None
    differentialDiagnosis: Optional[str] = None
    recommendedSteps: Optional[str] = None
    aiDraftReport: Optional[str] = None
    isArchived: int = 0

class CaseUpdateSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ai_status: Optional[str] = Field(None, alias="aiStatus")
    triage_color: Optional[str] = Field(None, alias="triageColor")
    confidence: Optional[float] = None
    priority: Optional[str] = None
    image_path: Optional[str] = Field(None, alias="imagePath")
    is_archived: Optional[int] = Field(None, alias="isArchived")
    risk_factors: Optional[str] = Field(None, alias="riskFactors")
    clinical_notes: Optional[str] = Field(None, alias="clinicalNotes")
    differential_diagnosis: Optional[str] = Field(None, alias="differentialDiagnosis")
    recommended_steps: Optional[str] = Field(None, alias="recommendedSteps")
    ai_draft_report: Optional[str] = Field(None, alias="aiDraftReport")

class EscalationBase(BaseModel):
    name: str
    age: int
    sex: str
    reasonForEscalation: str
    priority: str = "routine"
    aiTriage: str = "yellow"
    confidence: float = 0
    timeWaiting: str = "0h 0m"
    status: str = "awaiting"
    assignedTo: Optional[str] = None
    specialistNotes: Optional[str] = None

class EscalationCreateSchema(EscalationBase):
    patientId: str

class EscalationSchema(EscalationBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    patientId: str

class EscalationUpdateSchema(BaseModel):
    status: Optional[str] = None
    assignedTo: Optional[str] = None
    specialistNotes: Optional[str] = None
    clearAssignedTo: Optional[bool] = False

class StatsResponse(BaseModel):
    newCases: int
    urgentCases: int
    escalatedCases: int
    completedToday: int
    totalCases: int

class EscalationStatsResponse(BaseModel):
    awaiting: int
    inReview: int
    returned: int
    finalized: int

class FindingSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    case_id: str
    disease: str
    confidence: float
    bbox_x1: Optional[int] = None
    bbox_y1: Optional[int] = None
    bbox_x2: Optional[int] = None
    bbox_y2: Optional[int] = None
    report: Optional[str] = None
    severity: Optional[str] = None
    source_engine: Optional[str] = None


class LegacyReanalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    only_missing_findings: bool = Field(True, alias="onlyMissingFindings")
    include_archived: bool = Field(True, alias="includeArchived")
    limit: Optional[int] = None
    continue_on_error: bool = Field(True, alias="continueOnError")


class LegacyReanalyzeResult(BaseModel):
    total_considered: int = Field(..., alias="totalConsidered")
    processed: int
    analyzed: int
    bootstrapped: int
    skipped_has_findings: int = Field(..., alias="skippedHasFindings")
    skipped_missing_image: int = Field(..., alias="skippedMissingImage")
    failed: int
    errors: List[str]


class EHRTimelineEntry(BaseModel):
    timestamp: str
    entryType: str
    title: str
    details: str
    status: Optional[str] = None
    confidence: Optional[float] = None


class DeletePatientHistoryResult(BaseModel):
    patientId: str
    softDeletedCases: int
    softDeletedFindings: int
    softDeletedEscalations: int


class RecycleBinItem(BaseModel):
    patientId: str
    caseCount: int
    escalationCount: int
    deletedAt: Optional[str] = None


class AnalyzeJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    imagePath: str
    patientId: Optional[str] = None
    patientContext: Optional[str] = ""
    userAction: Optional[str] = "async_analyze"
    forceConsensus: bool = False


class AnalyzeJobStatus(BaseModel):
    jobId: str
    status: str
    progress: int
    attempts: int
    maxRetries: int
    cancelRequested: bool
    errorMessage: Optional[str] = None
    createdAt: str
    startedAt: Optional[str] = None
    finishedAt: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class PolicyRulesPayload(BaseModel):
    red_confidence_threshold: Optional[float] = None
    orange_confidence_threshold: Optional[float] = None
    low_confidence_review_threshold: Optional[float] = None
    consensus_trigger_confidence: Optional[float] = None
    high_risk_symptoms: Optional[List[str]] = None
    vital_overrides: Optional[Dict[str, float]] = None


class InferenceLedgerItem(BaseModel):
    runId: str
    caseId: Optional[str] = None
    modelId: str
    pipelineMode: str
    imageHash: str
    topPathology: Optional[str] = None
    rawConfidence: float
    calibratedConfidence: float
    confidenceBucket: str
    riskBand: Optional[str] = None
    expectedErrorBin: Optional[str] = None
    uncertainty: float
    latencyMs: float
    userAction: str
    policyAction: Optional[str] = None
    consensusState: Optional[str] = None
    status: str
    createdAt: str

# Routes


def _job_row_to_status(row: InferenceJob) -> AnalyzeJobStatus:
    parsed_result: Optional[Dict[str, Any]] = None
    if row.result_json:
        try:
            parsed_result = json.loads(row.result_json)
        except Exception:
            parsed_result = {"raw": row.result_json[:1000]}

    return AnalyzeJobStatus(
        jobId=row.job_id,
        status=row.status,
        progress=int(row.progress or 0),
        attempts=int(row.attempts or 0),
        maxRetries=int(row.max_retries or 0),
        cancelRequested=bool(row.cancel_requested),
        errorMessage=row.error_message,
        createdAt=(row.created_at or datetime.utcnow()).isoformat(),
        startedAt=row.started_at.isoformat() if row.started_at else None,
        finishedAt=row.finished_at.isoformat() if row.finished_at else None,
        result=parsed_result,
    )


def _execute_analysis_request(
    db: Session,
    image_path: str,
    patient_context: str,
    patient_id: Optional[str],
    user_action: str,
    force_consensus: bool = False,
) -> Dict[str, Any]:
    run_id = uuid.uuid4().hex
    started = time.perf_counter()

    db_case: Optional[Case] = None
    if patient_id:
        db_case = (
            db.query(Case)
            .filter(Case.patient_id == patient_id, Case.is_deleted == 0)
            .order_by(Case.id.desc())
            .first()
        )

    analysis = _run_active_pipeline(image_path, patient_context)
    analysis = _enrich_analysis(image_path, analysis, db_case, patient_context, force_consensus=force_consensus)
    analysis.setdefault("metadata", {})["runId"] = run_id

    if db_case is not None:
        _apply_analysis_to_case(db_case, analysis, db)

    image_hash = _hash_image(image_path)
    image_quality = analysis.get("metadata", {}).get("imageQuality")
    _record_inference_ledger(
        db,
        run_id=run_id,
        case_id=patient_id,
        image_hash=image_hash,
        analysis=analysis,
        user_action=user_action,
        image_quality=image_quality if isinstance(image_quality, (int, float)) else None,
    )

    total_ms = round((time.perf_counter() - started) * 1000.0, 1)
    analysis.setdefault("metadata", {})["requestLatencyMs"] = total_ms
    _write_event(
        "analysis_completed",
        {
            "runId": run_id,
            "caseId": patient_id,
            "engine": analysis.get("engine"),
            "status": analysis.get("status"),
            "latencyMs": total_ms,
        },
    )

    return analysis


def _inference_worker_loop() -> None:
    while True:
        job_id = INFERENCE_QUEUE.get()
        db = SessionLocal()
        try:
            job = db.query(InferenceJob).filter(InferenceJob.job_id == job_id).first()
            if job is None:
                INFERENCE_QUEUE.task_done()
                db.close()
                continue

            if job.cancel_requested:
                job.status = "cancelled"
                job.progress = 100
                job.finished_at = datetime.utcnow()
                db.commit()
                INFERENCE_QUEUE.task_done()
                db.close()
                continue

            job.status = "running"
            job.progress = 10
            job.attempts = int(job.attempts or 0) + 1
            job.started_at = datetime.utcnow()
            db.commit()

            try:
                patient_context = ""
                user_action = "async_analyze"
                if job.result_json:
                    try:
                        payload = json.loads(job.result_json)
                        patient_context = str(payload.get("patientContext") or "")
                        user_action = str(payload.get("userAction") or user_action)
                        force_consensus = bool(payload.get("forceConsensus", False))
                    except Exception:
                        force_consensus = False
                else:
                    force_consensus = False

                if job.cancel_requested:
                    job.status = "cancelled"
                    job.progress = 100
                    job.finished_at = datetime.utcnow()
                    db.commit()
                    INFERENCE_QUEUE.task_done()
                    db.close()
                    continue

                result = _execute_analysis_request(
                    db,
                    image_path=job.image_path,
                    patient_context=patient_context,
                    patient_id=job.case_id,
                    user_action=user_action,
                    force_consensus=force_consensus,
                )

                job.status = "completed"
                job.progress = 100
                job.finished_at = datetime.utcnow()
                job.result_json = json.dumps(result)
                db.commit()
            except Exception as ex:
                retryable = int(job.attempts or 0) <= int(job.max_retries or 0)
                job.error_message = str(ex)
                if retryable and not job.cancel_requested:
                    job.status = "retrying"
                    job.progress = 0
                    db.commit()
                    INFERENCE_QUEUE.put(job.job_id)
                else:
                    job.status = "failed"
                    job.progress = 100
                    job.finished_at = datetime.utcnow()
                    # Release the case from "analyzing" so it doesn't hang in
                    # the worklist after a terminal failure.
                    if job.case_id:
                        stuck_case = (
                            db.query(Case)
                            .filter(Case.patient_id == job.case_id, Case.is_deleted == 0)
                            .order_by(Case.id.desc())
                            .first()
                        )
                        if stuck_case is not None and stuck_case.ai_status == "analyzing":
                            stuck_case.ai_status = "ready"
                            stuck_case.ai_draft_report = f"Analysis failed: {str(ex)[:300]}"
                    db.commit()
        finally:
            try:
                db.close()
            except Exception:
                pass
            INFERENCE_QUEUE.task_done()


def _ensure_inference_worker() -> None:
    global INFERENCE_WORKER_STARTED
    with INFERENCE_WORKER_LOCK:
        if INFERENCE_WORKER_STARTED:
            return
        worker = threading.Thread(target=_inference_worker_loop, daemon=True)
        worker.start()
        INFERENCE_WORKER_STARTED = True


def _enqueue_analysis_job(
    db: Session,
    image_path: str,
    patient_id: Optional[str],
    patient_context: str,
    user_action: str,
    force_consensus: bool = False,
) -> InferenceJob:
    _ensure_inference_worker()
    row = InferenceJob(
        job_id=uuid.uuid4().hex,
        case_id=patient_id,
        image_path=image_path,
        pipeline_mode=active_ai_model,
        status="queued",
        progress=0,
        attempts=0,
        max_retries=2,
        cancel_requested=0,
        result_json=json.dumps(
            {
                "patientContext": patient_context,
                "userAction": user_action,
                "forceConsensus": force_consensus,
            }
        ),
    )
    db.add(row)
    db.commit()
    INFERENCE_QUEUE.put(row.job_id)
    _write_event("job_created", {"jobId": row.job_id, "caseId": patient_id, "mode": active_ai_model})
    return row


@app.get("/api/v1/cases", response_model=List[CaseFrontendSchema])
def get_cases(history: Optional[bool] = False, status: Optional[str] = None, triage: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Case).filter(Case.is_deleted == 0)
    if history:
        query = query.filter(Case.is_archived == 1)
    else:
        query = query.filter(Case.is_archived == 0)
        
    if status:
        query = query.filter(Case.ai_status == status)
    if triage:
        query = query.filter(Case.triage_color == triage)
    db_cases = query.all()
    # Map DB models to Frontend schema manually to avoid alias mismatch complexities
    result = []
    for c in db_cases:
        result.append(CaseFrontendSchema(
            patientId=c.patient_id,
            name=c.name,
            age=c.age,
            sex=c.sex,
            complaint=c.complaint,
            studyType=c.study_type,
            timeReceived=_format_case_time_local(c.time_received),
            aiStatus=c.ai_status,
            triageColor=c.triage_color,
            confidence=c.confidence,
            priority=c.priority,
            imagePath=c.image_path,
            vitalTemp=c.vital_temp,
            vitalHr=c.vital_hr,
            vitalBp=c.vital_bp,
            vitalResp=c.vital_resp,
            vitalSpo2=c.vital_spo2,
            vitalWeight=c.vital_weight,
            riskFactors=c.risk_factors,
            clinicalNotes=c.clinical_notes,
            differentialDiagnosis=c.differential_diagnosis,
            recommendedSteps=c.recommended_steps,
            aiDraftReport=c.ai_draft_report,
            isArchived=c.is_archived
        ))
    return result

@app.get("/api/v1/cases/stats/summary", response_model=StatsResponse)
def get_case_stats(db: Session = Depends(get_db)):
    base_q = db.query(Case).filter(Case.is_archived == 0, Case.is_deleted == 0)
    total = base_q.count()
    new_cases = base_q.filter(Case.ai_status == "ready").count()
    urgent = base_q.filter(Case.priority.in_(["High Priority", "urgent", "immediate"])).count()
    escalated = base_q.filter(Case.ai_status == "escalated").count()
    completed = base_q.filter(Case.ai_status == "complete").count()
    return {"newCases": new_cases, "urgentCases": urgent, "escalatedCases": escalated, "completedToday": completed, "totalCases": total}

@app.get("/api/v1/system/status")
def get_system_status(db: Session = Depends(get_db)):
    uptime = _format_uptime(datetime.utcnow() - APP_START_TIME)
    active_users = _active_users_count()

    queue_length = db.query(Case).filter(
        Case.is_archived == 0,
        Case.is_deleted == 0,
        Case.ai_status.in_(["ready", "analyzing"]),
    ).count()

    async_job_counts: Dict[str, int] = {}
    for status_name in ["queued", "running", "retrying", "failed", "completed", "cancelled"]:
        async_job_counts[status_name] = db.query(InferenceJob).filter(InferenceJob.status == status_name).count()

    retry_count = db.query(InferenceJob).filter(InferenceJob.status == "retrying").count()
    failed_jobs = db.query(InferenceJob).filter(InferenceJob.status == "failed").count()

    # Rough queue time estimate based on current pipeline mode.
    seconds_per_case = 20 if active_ai_model == "experiment2" else 45
    eta_seconds = queue_length * seconds_per_case
    eta_minutes, eta_remainder = divmod(eta_seconds, 60)
    eta_text = f"{eta_minutes}m {eta_remainder}s"

    if psutil is not None:
        cpu_usage = round(psutil.cpu_percent(interval=0.0), 1)
        memory_usage = round(psutil.virtual_memory().percent, 1)
    else:
        cpu_usage = 0.0
        memory_usage = 0.0

    return {
        "status": "online",
        "active_model": active_ai_model,
        "uptime": uptime,
        "cpu_usage": cpu_usage,
        "memory_usage": memory_usage,
        "active_users": active_users,
        "running_processes": _running_processes_snapshot(),
        "queue_length": queue_length,
        "estimated_wait_time": eta_text,
        "recent_errors": RECENT_ERROR_COUNT,
        "pipeline_stream": _pipeline_stream_snapshot(db),
        "model_warm_state": {
            "exp1_detector": _exp1_detector is not None,
            "exp1_analyzer": _exp1_analyzer is not None,
            "exp2_preprocessor": _exp2_preprocessor is not None,
        },
        "queue_stage_depth": async_job_counts,
        "retry_count": retry_count,
        "failed_jobs": failed_jobs,
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "hsil-backend",
        "active_model": active_ai_model,
    }


@app.get("/api/v1/health")
def api_health_check():
    return {
        "status": "ok",
        "service": "hsil-backend",
        "active_model": active_ai_model,
    }

@app.get("/api/v1/system/model")
def get_active_model():
    return {"modelId": active_ai_model, "activeModel": active_ai_model}

@app.post("/api/v1/system/model")
def set_active_model(data: Dict[str, str]):
    global active_ai_model
    new_model = (data.get("modelId") or "").lower()
    if not new_model:
        raise HTTPException(status_code=400, detail="modelId required")
    if new_model not in ALLOWED_PIPELINES:
        raise HTTPException(status_code=400, detail="Invalid modelId")

    if new_model in {"experiment2", "both"}:
        try:
            _get_exp2_preprocessor()
        except Exception as ex:
            raise HTTPException(status_code=400, detail=f"Experiment 2 unavailable: {ex}")

    active_ai_model = new_model
    _persist_active_model(active_ai_model)
    return {"status": "success", "activeModel": active_ai_model, "modelId": active_ai_model}


@app.get("/api/v1/policy/rules")
def get_policy_rules():
    return POLICY_RULES


@app.post("/api/v1/policy/rules")
def update_policy_rules(payload: PolicyRulesPayload):
    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        POLICY_RULES[key] = value
    return {"status": "updated", "rules": POLICY_RULES}


@app.post("/api/v1/analyze/jobs", response_model=AnalyzeJobStatus)
def create_analyze_job(payload: AnalyzeJobRequest, db: Session = Depends(get_db)):
    image_path = _resolve_image_path(payload.imagePath)
    if not image_path or not os.path.exists(image_path):
        raise HTTPException(status_code=400, detail="Valid imagePath is required")

    row = _enqueue_analysis_job(
        db,
        image_path=image_path,
        patient_id=payload.patientId,
        patient_context=payload.patientContext or "",
        user_action=payload.userAction or "async_analyze",
        force_consensus=payload.forceConsensus,
    )
    return _job_row_to_status(row)


@app.get("/api/v1/analyze/jobs", response_model=List[AnalyzeJobStatus])
def list_analyze_jobs(limit: int = 50, db: Session = Depends(get_db)):
    rows = (
        db.query(InferenceJob)
        .order_by(InferenceJob.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return [_job_row_to_status(row) for row in rows]


@app.get("/api/v1/analyze/jobs/{job_id}", response_model=AnalyzeJobStatus)
def get_analyze_job(job_id: str, db: Session = Depends(get_db)):
    row = db.query(InferenceJob).filter(InferenceJob.job_id == job_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_row_to_status(row)


@app.post("/api/v1/analyze/jobs/{job_id}/cancel", response_model=AnalyzeJobStatus)
def cancel_analyze_job(job_id: str, db: Session = Depends(get_db)):
    row = db.query(InferenceJob).filter(InferenceJob.job_id == job_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if row.status in {"completed", "failed", "cancelled"}:
        return _job_row_to_status(row)

    row.cancel_requested = 1
    if row.status in {"queued", "retrying"}:
        row.status = "cancelled"
        row.progress = 100
        row.finished_at = datetime.utcnow()
    db.commit()
    _write_event("job_cancelled", {"jobId": job_id, "status": row.status})
    return _job_row_to_status(row)


@app.get("/api/v1/admin/inference-ledger", response_model=List[InferenceLedgerItem])
def get_inference_ledger(caseId: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(InferenceLedger)
    if caseId:
        query = query.filter(InferenceLedger.case_id == caseId)
    rows = query.order_by(InferenceLedger.created_at.desc()).limit(max(1, min(limit, 500))).all()

    result: List[InferenceLedgerItem] = []
    for row in rows:
        result.append(
            InferenceLedgerItem(
                runId=row.run_id,
                caseId=row.case_id,
                modelId=row.model_id,
                pipelineMode=row.pipeline_mode,
                imageHash=row.image_hash,
                topPathology=row.top_pathology,
                rawConfidence=float(row.raw_confidence or 0.0),
                calibratedConfidence=float(row.calibrated_confidence or 0.0),
                confidenceBucket=row.confidence_bucket,
                riskBand=row.risk_band,
                expectedErrorBin=row.expected_error_bin,
                uncertainty=float(row.uncertainty or 0.0),
                latencyMs=float(row.latency_ms or 0.0),
                userAction=row.user_action,
                policyAction=row.policy_action,
                consensusState=row.consensus_state,
                status=row.status,
                createdAt=(row.created_at or datetime.utcnow()).isoformat(),
            )
        )
    return result


@app.get("/api/v1/admin/observability")
def get_observability(db: Session = Depends(get_db)):
    endpoints: Dict[str, Any] = {}
    for key, metric in ENDPOINT_METRICS.items():
        count = int(metric["count"] or 0)
        avg_ms = (metric["total_ms"] / count) if count > 0 else 0.0
        window = list(OBS_LATENCY_WINDOWS.get(key, []))
        p95 = 0.0
        if window:
            sorted_vals = sorted(window)
            idx = int(0.95 * (len(sorted_vals) - 1))
            p95 = float(sorted_vals[idx])
        endpoints[key] = {
            "count": count,
            "errors": int(metric["errors"] or 0),
            "avgMs": round(avg_ms, 2),
            "p95Ms": round(p95, 2),
            "maxMs": round(float(metric["max_ms"] or 0.0), 2),
        }

    queue_stage_depth = {
        s: db.query(InferenceJob).filter(InferenceJob.status == s).count()
        for s in ["queued", "running", "retrying", "failed", "completed", "cancelled"]
    }

    return {
        "activePipeline": active_ai_model,
        "modelWarmState": {
            "exp1Detector": _exp1_detector is not None,
            "exp1Analyzer": _exp1_analyzer is not None,
            "exp2Preprocessor": _exp2_preprocessor is not None,
        },
        "queueStageDepth": queue_stage_depth,
        "endpoints": endpoints,
        "recentErrorCount": RECENT_ERROR_COUNT,
    }


@app.get("/api/v1/admin/drift")
def get_drift_report(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=7)
    baseline_cutoff = now - timedelta(days=14)

    recent = db.query(InferenceLedger).filter(InferenceLedger.created_at >= recent_cutoff).all()
    baseline = db.query(InferenceLedger).filter(
        InferenceLedger.created_at >= baseline_cutoff,
        InferenceLedger.created_at < recent_cutoff,
    ).all()

    def pathology_dist(rows: List[InferenceLedger]) -> Dict[str, int]:
        dist: Dict[str, int] = defaultdict(int)
        for row in rows:
            key = (row.top_pathology or "unknown")[:80]
            dist[key] += 1
        return dict(sorted(dist.items(), key=lambda kv: kv[1], reverse=True)[:10])

    def avg_conf(rows: List[InferenceLedger]) -> float:
        if not rows:
            return 0.0
        return round(sum(float(r.calibrated_confidence or 0.0) for r in rows) / len(rows), 4)

    def low_quality_rate(rows: List[InferenceLedger]) -> float:
        if not rows:
            return 0.0
        low = [r for r in rows if r.image_quality_score is not None and float(r.image_quality_score) < 0.2]
        return round(len(low) / len(rows), 4)

    return {
        "recentWindowDays": 7,
        "recentCount": len(recent),
        "baselineCount": len(baseline),
        "recentCaseMix": pathology_dist(recent),
        "baselineCaseMix": pathology_dist(baseline),
        "recentAvgCalibratedConfidence": avg_conf(recent),
        "baselineAvgCalibratedConfidence": avg_conf(baseline),
        "confidenceDrift": round(avg_conf(recent) - avg_conf(baseline), 4),
        "recentLowQualityRate": low_quality_rate(recent),
        "baselineLowQualityRate": low_quality_rate(baseline),
    }


@app.get("/api/v1/escalations/{patient_id}/timeline")
def get_escalation_timeline(patient_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(EscalationEvent)
        .filter(EscalationEvent.patient_id == patient_id)
        .order_by(EscalationEvent.created_at.desc())
        .all()
    )
    return [
        {
            "eventType": row.event_type,
            "oldStatus": row.old_status,
            "newStatus": row.new_status,
            "reason": row.reason,
            "actor": row.actor,
            "timestamp": (row.created_at or datetime.utcnow()).isoformat(),
        }
        for row in rows
    ]

@app.get("/api/v1/cases/{patient_id}", response_model=CaseFrontendSchema)
def get_case(patient_id: str, db: Session = Depends(get_db)):
    # Order by ID descending to get the most recent visit first
    c = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 0).order_by(Case.id.desc()).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseFrontendSchema(
            patientId=c.patient_id,
            name=c.name,
            age=c.age,
            sex=c.sex,
            complaint=c.complaint,
            studyType=c.study_type,
            timeReceived=_format_case_time_local(c.time_received),
            aiStatus=c.ai_status,
            triageColor=c.triage_color,
            confidence=c.confidence,
            priority=c.priority,
            imagePath=c.image_path,
            vitalTemp=c.vital_temp,
            vitalHr=c.vital_hr,
            vitalBp=c.vital_bp,
            vitalResp=c.vital_resp,
            vitalSpo2=c.vital_spo2,
            vitalWeight=c.vital_weight,
            riskFactors=c.risk_factors,
            clinicalNotes=c.clinical_notes,
            differentialDiagnosis=c.differential_diagnosis,
            recommendedSteps=c.recommended_steps,
            aiDraftReport=c.ai_draft_report,
            isArchived=c.is_archived
        )

@app.post("/api/v1/cases", response_model=CaseFrontendSchema)
def create_case(case: CaseCreateSchema, db: Session = Depends(get_db)):
    data = case.model_dump()
    db_case = Case(**data)
    db.add(db_case)
    db.commit()
    db.refresh(db_case)

    # Queue analysis asynchronously so case creation returns immediately;
    # the worker thread updates the case when inference completes.
    resolved_path = _resolve_image_path(db_case.image_path)
    if resolved_path and os.path.exists(resolved_path) and active_ai_model != "none":
        patient_context = f"{db_case.age}{db_case.sex}, complaint: {db_case.complaint}"
        db_case.ai_status = "analyzing"
        db.commit()
        _enqueue_analysis_job(
            db,
            image_path=resolved_path,
            patient_id=db_case.patient_id,
            patient_context=patient_context,
            user_action="case_created",
        )

    # Re-fetch as the Frontend Schema to ensure proper serialization
    return get_case(db_case.patient_id, db=db)

@app.put("/api/v1/cases/{patient_id}")
def update_case(patient_id: str, case: CaseUpdateSchema, db: Session = Depends(get_db)):
    db_case = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 0).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")
    update_data = case.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_case, key, value)
    db.commit()
    return {"status": "updated"}


class ReportDownloadRequest(BaseModel):
    specialistNotes: Optional[str] = None


@app.post("/api/v1/cases/{patient_id}/download")
def download_case_report(patient_id: str, payload: ReportDownloadRequest, db: Session = Depends(get_db)):
    c = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 0).order_by(Case.id.desc()).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    findings = (
        db.query(Finding)
        .filter(Finding.case_id == patient_id, Finding.is_deleted == 0)
        .order_by(Finding.confidence.desc())
        .all()
    )

    lines: List[str] = [
        "RADFLOW-EDGE PRELIMINARY RADIOLOGY REPORT",
        "=" * 48,
        f"Patient ID:    {c.patient_id}",
        f"Name:          {c.name}",
        f"Age/Sex:       {c.age} / {c.sex}",
        f"Study:         {c.study_type}",
        f"Complaint:     {c.complaint}",
        f"Triage:        {str(c.triage_color or 'green').upper()}  |  Priority: {c.priority or 'routine'}",
        f"AI Confidence: {round(float(c.confidence or 0.0) * 100, 1)}%",
        f"Generated:     {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC",
        "",
    ]

    vitals = [
        ("Temp", c.vital_temp, "°C"),
        ("HR", c.vital_hr, "bpm"),
        ("BP", c.vital_bp, ""),
        ("Resp", c.vital_resp, "/min"),
        ("SpO2", c.vital_spo2, "%"),
        ("Weight", c.vital_weight, "kg"),
    ]
    vital_parts = [f"{label}: {value}{unit}" for label, value, unit in vitals if value is not None]
    if vital_parts:
        lines += ["VITALS", "-" * 48, "  |  ".join(vital_parts), ""]

    if findings:
        lines += ["AI FINDINGS", "-" * 48]
        for f in findings:
            bbox = ""
            if f.bbox_x1 is not None:
                bbox = f"  bbox=({f.bbox_x1},{f.bbox_y1},{f.bbox_x2},{f.bbox_y2})"
            lines.append(f"- {f.disease} ({round(float(f.confidence or 0.0) * 100, 1)}%){bbox}")
        lines.append("")

    if c.ai_draft_report:
        lines += ["DRAFT REPORT", "-" * 48, c.ai_draft_report.strip(), ""]

    notes = _clean_optional_text(payload.specialistNotes)
    if notes:
        lines += ["SPECIALIST NOTES", "-" * 48, notes, ""]

    lines += [
        "-" * 48,
        "Draft preliminary findings generated by clinical decision support.",
        "Final interpretation requires review by a qualified clinician.",
    ]

    filename = f"radflow_report_{patient_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.txt"
    return {"content": "\n".join(lines), "filename": filename}


@app.get("/api/v1/escalations", response_model=List[EscalationSchema])
def get_escalations(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Escalation).filter(Escalation.is_deleted == 0)
    if status:
        query = query.filter(Escalation.status == status)
    db_esc = query.all()
    return [_escalation_to_schema(e) for e in db_esc]


def _escalation_to_schema(e: Escalation) -> EscalationSchema:
    return EscalationSchema(
        patientId=e.patient_id,
        name=e.name,
        age=e.age,
        sex=e.sex,
        reasonForEscalation=e.reason_for_escalation,
        priority=e.priority,
        aiTriage=e.ai_triage,
        confidence=e.confidence,
        timeWaiting=_format_time_waiting(e.created_at),
        status=e.status,
        assignedTo=e.assigned_to,
        specialistNotes=e.specialist_notes,
    )

@app.post("/api/v1/escalations", response_model=EscalationSchema)
def create_escalation(esc: EscalationCreateSchema, db: Session = Depends(get_db)):
    data = esc.model_dump()
    data["patient_id"] = data.pop("patientId")
    data["reason_for_escalation"] = data.pop("reasonForEscalation")
    data["ai_triage"] = data.pop("aiTriage")
    data["time_waiting"] = data.pop("timeWaiting")
    data["assigned_to"] = data.pop("assignedTo", None)
    data["specialist_notes"] = data.pop("specialistNotes", None)
    
    db_esc = Escalation(**data)
    db.add(db_esc)
    db.add(
        EscalationEvent(
            patient_id=db_esc.patient_id,
            event_type="created",
            old_status=None,
            new_status=db_esc.status,
            reason=db_esc.reason_for_escalation,
            actor="api",
        )
    )
    db.commit()
    db.refresh(db_esc)
    return _escalation_to_schema(db_esc)

@app.get("/api/v1/escalations/stats")
def get_escalation_stats(db: Session = Depends(get_db)):
    awaiting = db.query(Escalation).filter(Escalation.status == "awaiting", Escalation.is_deleted == 0).count()
    in_review = db.query(Escalation).filter(Escalation.status == "in-review", Escalation.is_deleted == 0).count()
    returned = db.query(Escalation).filter(Escalation.status == "returned", Escalation.is_deleted == 0).count()
    finalized = db.query(Escalation).filter(Escalation.status == "finalized", Escalation.is_deleted == 0).count()
    return {"awaiting": awaiting, "inReview": in_review, "returned": returned, "finalized": finalized}

@app.put("/api/v1/escalations/{patient_id}")
def update_escalation(patient_id: str, esc: EscalationUpdateSchema, db: Session = Depends(get_db)):
    db_esc = db.query(Escalation).filter(Escalation.patient_id == patient_id, Escalation.is_deleted == 0).first()
    if not db_esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    old_status = db_esc.status
    if esc.status is not None:
        db_esc.status = esc.status
    if esc.clearAssignedTo:
        db_esc.assigned_to = None
    elif esc.assignedTo is not None:
        db_esc.assigned_to = esc.assignedTo
    if esc.specialistNotes is not None:
        db_esc.specialist_notes = esc.specialistNotes
    if esc.status is not None or esc.assignedTo is not None or esc.specialistNotes is not None or esc.clearAssignedTo:
        reason_parts: List[str] = []
        if esc.clearAssignedTo:
            reason_parts.append("assignment_cleared")
        elif esc.assignedTo is not None:
            reason_parts.append(f"assigned_to:{esc.assignedTo}")
        if esc.specialistNotes is not None:
            reason_parts.append("specialist_note_updated")
        db.add(
            EscalationEvent(
                patient_id=patient_id,
                event_type="updated",
                old_status=old_status,
                new_status=db_esc.status,
                reason="; ".join(reason_parts) if reason_parts else None,
                actor="api",
            )
        )
    db.commit()
    return {"status": "updated"}


@app.get("/api/v1/ehr/{patient_id}/timeline", response_model=List[EHRTimelineEntry])
def get_ehr_timeline(patient_id: str, db: Session = Depends(get_db)):
    cases = db.query(Case).filter(Case.patient_id == patient_id).order_by(Case.created_at.asc()).all()
    escalations = db.query(Escalation).filter(Escalation.patient_id == patient_id).order_by(Escalation.created_at.asc()).all()

    timeline: List[EHRTimelineEntry] = []

    for idx, case_obj in enumerate(cases, start=1):
        report_text = (case_obj.ai_draft_report or "No AI draft report available.").strip()
        report_summary = report_text if len(report_text) <= 220 else f"{report_text[:220]}..."
        timeline.append(
            EHRTimelineEntry(
                timestamp=(case_obj.created_at or datetime.utcnow()).isoformat(),
                entryType="report_version",
                title=f"Radiology Report v{idx}",
                details=f"{case_obj.study_type} | Complaint: {case_obj.complaint}\n{report_summary}",
                status=case_obj.ai_status,
                confidence=float(case_obj.confidence or 0.0),
            )
        )

    for esc in escalations:
        timeline.append(
            EHRTimelineEntry(
                timestamp=(esc.created_at or datetime.utcnow()).isoformat(),
                entryType="escalation",
                title="Escalation Created",
                details=f"Reason: {esc.reason_for_escalation}",
                status=esc.status,
                confidence=float(esc.confidence or 0.0),
            )
        )

        if esc.specialist_notes:
            timeline.append(
                EHRTimelineEntry(
                    timestamp=(esc.updated_at or esc.created_at or datetime.utcnow()).isoformat(),
                    entryType="specialist_note",
                    title="Specialist Finalization Note",
                    details=esc.specialist_notes,
                    status=esc.status,
                    confidence=float(esc.confidence or 0.0),
                )
            )

    timeline.sort(key=lambda item: item.timestamp, reverse=True)
    return timeline


@app.delete("/api/v1/ehr/{patient_id}", response_model=DeletePatientHistoryResult)
def delete_patient_history(patient_id: str, db: Session = Depends(get_db)):
    now = datetime.utcnow()

    deleted_cases = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 0).update(
        {Case.is_deleted: 1, Case.deleted_at: now}, synchronize_session=False
    )
    deleted_findings = db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 0).update(
        {Finding.is_deleted: 1, Finding.deleted_at: now}, synchronize_session=False
    )
    deleted_escalations = db.query(Escalation).filter(Escalation.patient_id == patient_id, Escalation.is_deleted == 0).update(
        {Escalation.is_deleted: 1, Escalation.deleted_at: now}, synchronize_session=False
    )
    db.commit()

    return DeletePatientHistoryResult(
        patientId=patient_id,
        softDeletedCases=deleted_cases,
        softDeletedFindings=deleted_findings,
        softDeletedEscalations=deleted_escalations,
    )


@app.get("/api/v1/admin/recycle-bin", response_model=List[RecycleBinItem])
def get_recycle_bin(db: Session = Depends(get_db)):
    deleted_cases = db.query(Case).filter(Case.is_deleted == 1).all()
    deleted_escalations = db.query(Escalation).filter(Escalation.is_deleted == 1).all()

    bucket: Dict[str, RecycleBinItem] = {}

    for c in deleted_cases:
        item = bucket.get(c.patient_id)
        ts = c.deleted_at.isoformat() if c.deleted_at else None
        if item is None:
            bucket[c.patient_id] = RecycleBinItem(patientId=c.patient_id, caseCount=1, escalationCount=0, deletedAt=ts)
        else:
            item.caseCount += 1
            if ts and (item.deletedAt is None or ts > item.deletedAt):
                item.deletedAt = ts

    for e in deleted_escalations:
        item = bucket.get(e.patient_id)
        ts = e.deleted_at.isoformat() if e.deleted_at else None
        if item is None:
            bucket[e.patient_id] = RecycleBinItem(patientId=e.patient_id, caseCount=0, escalationCount=1, deletedAt=ts)
        else:
            item.escalationCount += 1
            if ts and (item.deletedAt is None or ts > item.deletedAt):
                item.deletedAt = ts

    return sorted(bucket.values(), key=lambda item: item.deletedAt or "", reverse=True)


@app.post("/api/v1/admin/recycle-bin/{patient_id}/restore", response_model=DeletePatientHistoryResult)
def restore_patient_history(patient_id: str, db: Session = Depends(get_db)):
    restored_cases = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 1).update(
        {Case.is_deleted: 0, Case.deleted_at: None}, synchronize_session=False
    )
    restored_findings = db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 1).update(
        {Finding.is_deleted: 0, Finding.deleted_at: None}, synchronize_session=False
    )
    restored_escalations = db.query(Escalation).filter(Escalation.patient_id == patient_id, Escalation.is_deleted == 1).update(
        {Escalation.is_deleted: 0, Escalation.deleted_at: None}, synchronize_session=False
    )
    db.commit()

    return DeletePatientHistoryResult(
        patientId=patient_id,
        softDeletedCases=restored_cases,
        softDeletedFindings=restored_findings,
        softDeletedEscalations=restored_escalations,
    )

@app.get("/api/v1/findings/{patient_id}", response_model=List[FindingSchema])
def get_findings(patient_id: str, db: Session = Depends(get_db)):
    return db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 0).all() or _ensure_findings_for_case(patient_id, db)


@app.post("/api/v1/admin/reanalyze-legacy", response_model=LegacyReanalyzeResult)
def reanalyze_legacy_cases(payload: LegacyReanalyzeRequest, db: Session = Depends(get_db)):
    query = db.query(Case).filter(Case.is_deleted == 0)
    if not payload.include_archived:
        query = query.filter(Case.is_archived == 0)

    cases = query.order_by(Case.id.asc()).all()
    if payload.limit is not None and payload.limit > 0:
        cases = cases[: payload.limit]

    total_considered = len(cases)
    processed = 0
    analyzed = 0
    bootstrapped = 0
    skipped_has_findings = 0
    skipped_missing_image = 0
    failed = 0
    errors: List[str] = []

    for case_obj in cases:
        try:
            existing_count = db.query(Finding).filter(Finding.case_id == case_obj.patient_id).count()
            if payload.only_missing_findings and existing_count > 0:
                skipped_has_findings += 1
                continue

            resolved_path = _resolve_image_path(case_obj.image_path)
            if resolved_path and os.path.exists(resolved_path) and active_ai_model != "none":
                patient_context = f"{case_obj.age}{case_obj.sex}, complaint: {case_obj.complaint}"
                analysis = _run_active_pipeline(resolved_path, patient_context)
                _apply_analysis_to_case(case_obj, analysis, db)

                persisted = db.query(Finding).filter(Finding.case_id == case_obj.patient_id).count()
                if persisted > 0:
                    analyzed += 1
                else:
                    if _bootstrap_legacy_finding_if_possible(case_obj, db):
                        bootstrapped += 1
                    else:
                        skipped_missing_image += 1
            else:
                if _bootstrap_legacy_finding_if_possible(case_obj, db):
                    bootstrapped += 1
                else:
                    skipped_missing_image += 1

            processed += 1
        except Exception as ex:
            failed += 1
            errors.append(f"{case_obj.patient_id}: {ex}")
            if not payload.continue_on_error:
                break

    return LegacyReanalyzeResult(
        totalConsidered=total_considered,
        processed=processed,
        analyzed=analyzed,
        bootstrapped=bootstrapped,
        skippedHasFindings=skipped_has_findings,
        skippedMissingImage=skipped_missing_image,
        failed=failed,
        errors=errors[:50],
    )

@app.post("/api/v1/findings/{patient_id}")
def create_finding(patient_id: str, finding: FindingSchema, db: Session = Depends(get_db)):
    fnd = Finding(**finding.model_dump())
    fnd.case_id = patient_id
    db.add(fnd)
    db.commit()
    return {"status": "saved"}

# AI analysis endpoints
@app.post("/api/v1/analyze")
def analyze_xray(data: Dict[Any, Any], db: Session = Depends(get_db)):
    image_path = _resolve_image_path(data.get("imagePath"))
    if not image_path or not os.path.exists(image_path):
        raise HTTPException(status_code=400, detail="Valid imagePath is required")

    patient_context = data.get("patient_context") or data.get("patientContext") or ""
    patient_id = data.get("patientId")
    user_action = str(data.get("userAction") or "manual_analyze")
    force_consensus = bool(data.get("forceConsensus", False))

    return _execute_analysis_request(
        db,
        image_path=image_path,
        patient_context=patient_context,
        patient_id=patient_id,
        user_action=user_action,
        force_consensus=force_consensus,
    )

@app.post("/api/v1/foveal")
def foveal_preprocess(data: Dict[Any, Any]):
    image_path = _resolve_image_path(data.get("imagePath"))
    if not image_path or not os.path.exists(image_path):
        raise HTTPException(status_code=400, detail="Valid imagePath is required")

    preprocessor = _get_exp2_preprocessor()
    results = preprocessor.process(image_path)
    bbox = results["bbox"]
    return {
        "status": "preprocessed",
        "bbox": [int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])],
        "globalShape": list(results["global_context"].shape),
        "cropShape": list(results["foveal_crop"].shape),
    }


def _truncate_prompt_text(text: Optional[str], max_len: int = 1500) -> str:
    cleaned = _clean_optional_text(text) or ""
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len] + "..."


# Gemma 4 E2B (via Ollama) is the single local LLM for every text/vision task
# the detector pipeline does not cover: copilot chat and report narratives.
def _get_local_llm_model() -> str:
    return os.getenv("HSIL_COPILOT_MODEL", "gemma4:e2b")


def _get_ollama_base_url() -> str:
    return os.getenv("HSIL_OLLAMA_URL", "http://localhost:11434").rstrip("/")


_OLLAMA_AVAILABILITY: Dict[str, Any] = {"checked_at": 0.0, "available": False}
_OLLAMA_AVAILABILITY_TTL_SEC = 60.0


def _is_local_llm_available() -> bool:
    now = time.monotonic()
    if now - _OLLAMA_AVAILABILITY["checked_at"] < _OLLAMA_AVAILABILITY_TTL_SEC:
        return bool(_OLLAMA_AVAILABILITY["available"])

    available = False
    try:
        resp = requests.get(f"{_get_ollama_base_url()}/api/tags", timeout=2)
        resp.raise_for_status()
        wanted = _get_local_llm_model().lower()
        names = [str(item.get("name") or "").lower() for item in resp.json().get("models", [])]
        available = wanted in names
    except Exception:
        available = False

    _OLLAMA_AVAILABILITY["checked_at"] = now
    _OLLAMA_AVAILABILITY["available"] = available
    return available


def _ollama_chat(messages: List[Dict[str, Any]], timeout_sec: float, num_predict: Optional[int] = None) -> str:
    options: Dict[str, Any] = {"temperature": 0.2, "top_p": 0.9}
    if num_predict:
        options["num_predict"] = num_predict
    payload = {
        "model": _get_local_llm_model(),
        "messages": messages,
        "stream": False,
        "options": options,
    }
    resp = requests.post(f"{_get_ollama_base_url()}/api/chat", json=payload, timeout=timeout_sec)
    resp.raise_for_status()
    content = str((resp.json().get("message") or {}).get("content") or "").strip()
    if not content:
        raise RuntimeError("Local model returned an empty response")
    return content


def _gemma_narrative_report(
    crop_img: Optional[Any],
    image_path: str,
    disease: str,
    confidence: float,
    patient_context: str,
) -> Optional[str]:
    """Generate a structured draft report with Gemma 4 E2B vision.

    Used when the CheXagent analyzer is unavailable (the default on
    non-CUDA edge devices). Returns None when the local model is disabled,
    unreachable, or fails — callers keep their detector-only fallback.
    """
    if os.getenv("HSIL_DISABLE_GEMMA_ANALYZER", "0") == "1":
        return None
    if not _is_local_llm_available():
        return None

    import base64
    import cv2

    try:
        if crop_img is not None:
            ok, buf = cv2.imencode(".png", crop_img)
            if not ok:
                return None
            image_b64 = base64.b64encode(buf.tobytes()).decode("ascii")
        else:
            with open(image_path, "rb") as fp:
                image_b64 = base64.b64encode(fp.read()).decode("ascii")

        prompt = (
            "You are a radiology assistant reviewing a chest X-ray region for a frontline nurse.\n"
            f"Patient context: {patient_context or 'not provided'}\n"
            f"CNN detector finding: {disease} (confidence {confidence:.0%})\n\n"
            "Write a concise draft report using exactly these section headers:\n\n"
            "KEY FINDINGS: what is visible in the image and whether it supports the detector finding.\n"
            "DIFFERENTIAL DIAGNOSTICS: primary diagnosis plus 2-3 alternatives to consider.\n"
            "FUTURE STEPS/PRECAUTIONS: 2-4 practical next actions for a rural clinic.\n\n"
            "Be specific and clinical. Do not invent patient history that was not provided."
        )
        timeout_sec = _read_env_float("HSIL_GEMMA_TIMEOUT_SEC", 120.0)
        return _ollama_chat(
            [{"role": "user", "content": prompt, "images": [image_b64]}],
            timeout_sec=timeout_sec,
            num_predict=400,
        )
    except Exception as ex:
        _write_event("gemma_narrative_failed", {"error": str(ex)[:300]})
        return None


def _read_env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _call_ollama_case_copilot(message: str, context_payload: Dict[str, Any]) -> Dict[str, str]:
    model_name = _get_local_llm_model()

    system_prompt = (
        "You are HSIL Clinical Copilot. Respond for clinicians reviewing a chest X-ray case. "
        "Use concise, clinically appropriate language with practical suggestions. "
        "Prefer percentages for confidence when present. "
        "Base your answer strictly on supplied case context. "
        "If data is missing, explicitly say what is missing and what to verify next."
    )

    user_prompt = (
        "CASE CONTEXT (JSON):\n"
        f"{json.dumps(context_payload, ensure_ascii=True)}\n\n"
        "CLINICIAN QUESTION:\n"
        f"{message}\n\n"
        "Respond with: 1) direct answer, 2) short rationale, 3) suggested next actions."
    )

    content = _ollama_chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        timeout_sec=60,
    )
    return {"model": model_name, "response": content}


def _build_case_copilot_context(db: Session, patient_id: str) -> Optional[Dict[str, Any]]:
    case_obj = (
        db.query(Case)
        .filter(Case.patient_id == patient_id, Case.is_deleted == 0)
        .order_by(Case.id.desc())
        .first()
    )
    if case_obj is None:
        return None

    findings = (
        db.query(Finding)
        .filter(Finding.case_id == patient_id, Finding.is_deleted == 0)
        .order_by(Finding.confidence.desc())
        .all()
    )
    findings_payload: List[Dict[str, Any]] = []
    for item in findings[:6]:
        findings_payload.append(
            {
                "disease": item.disease,
                "confidence": round(float(item.confidence or 0.0) * 100.0, 1),
                "report": _truncate_prompt_text(item.report, max_len=350),
                "bbox": [item.bbox_x1, item.bbox_y1, item.bbox_x2, item.bbox_y2],
            }
        )

    latest_ledger = (
        db.query(InferenceLedger)
        .filter(InferenceLedger.case_id == patient_id)
        .order_by(InferenceLedger.created_at.desc())
        .first()
    )

    return {
        "patientId": case_obj.patient_id,
        "name": case_obj.name,
        "age": case_obj.age,
        "sex": case_obj.sex,
        "studyType": case_obj.study_type,
        "complaint": _truncate_prompt_text(case_obj.complaint, 300),
        "clinicalNotes": _truncate_prompt_text(case_obj.clinical_notes, 600),
        "riskFactors": _truncate_prompt_text(case_obj.risk_factors, 400),
        "aiStatus": case_obj.ai_status,
        "triageColor": case_obj.triage_color,
        "priority": case_obj.priority,
        "confidencePercent": round(float(case_obj.confidence or 0.0) * (100.0 if float(case_obj.confidence or 0.0) <= 1.0 else 1.0), 1),
        "differentialDiagnosis": _truncate_prompt_text(case_obj.differential_diagnosis, 1000),
        "recommendedSteps": _truncate_prompt_text(case_obj.recommended_steps, 1000),
        "aiDraftReport": _truncate_prompt_text(case_obj.ai_draft_report, 2000),
        "vitals": {
            "temp": case_obj.vital_temp,
            "hr": case_obj.vital_hr,
            "bp": case_obj.vital_bp,
            "resp": case_obj.vital_resp,
            "spo2": case_obj.vital_spo2,
            "weight": case_obj.vital_weight,
        },
        "findings": findings_payload,
        "latestInference": {
            "modelId": latest_ledger.model_id if latest_ledger else None,
            "calibratedConfidencePercent": round(float(latest_ledger.calibrated_confidence or 0.0) * 100.0, 1) if latest_ledger else None,
            "riskBand": latest_ledger.risk_band if latest_ledger else None,
            "policyAction": latest_ledger.policy_action if latest_ledger else None,
            "consensusState": latest_ledger.consensus_state if latest_ledger else None,
        },
        "activeModel": active_ai_model,
    }

@app.post("/api/v1/chat")
def chat(data: Dict[Any, Any], db: Session = Depends(get_db)):
    message = str(data.get("message", "")).strip()
    patient_id = data.get("patientId")

    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    if not patient_id:
        return {
            "response": (
                "Please open a case first so I can answer with patient-specific context from the database."
            )
        }

    case_context = _build_case_copilot_context(db, str(patient_id))
    if case_context is None:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        model_result = _call_ollama_case_copilot(message, case_context)
        return {
            "response": model_result["response"],
            "model": model_result["model"],
            "activeModel": active_ai_model,
        }
    except Exception as ex:
        fallback = (
            "Copilot fallback: local Gemma/Ollama is unavailable right now. "
            f"Current triage is {case_context.get('triageColor')} with confidence {case_context.get('confidencePercent')}%. "
            "Please verify key findings, differential diagnosis, and recommended steps in the report card while Ollama is restarting. "
            f"Technical detail: {str(ex)[:200]}"
        )
        return {"response": fallback, "activeModel": active_ai_model}

ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".jfif", ".bmp", ".tif", ".tiff", ".dcm"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@app.post("/api/v1/upload")
async def upload_image(file: UploadFile = File(...)):
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if file_ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(files_dir, unique_filename)

    size = 0
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                buffer.close()
                os.remove(file_path)
                raise HTTPException(status_code=413, detail="File exceeds 50MB limit")
            buffer.write(chunk)

    if size == 0:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Empty file")

    return {"imagePath": f".files/{unique_filename}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
