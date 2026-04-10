import os
import shutil
import uuid
import sys
import time
import tempfile
import traceback
import importlib.util
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from database import SessionLocal, Case, Finding, Escalation, SystemStats

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

    # Prune stale activity entries to keep active users meaningful.
    cutoff = now - timedelta(seconds=ACTIVE_USER_WINDOW_SECONDS)
    stale_hosts = [host for host, ts in REQUEST_ACTIVITY.items() if ts < cutoff]
    for host in stale_hosts:
        REQUEST_ACTIVITY.pop(host, None)

    response = await call_next(request)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    global RECENT_ERROR_COUNT
    RECENT_ERROR_COUNT += 1
    print(f"CRITICAL ERROR: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )


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


def _get_exp1_analyzer_optional():
    global _exp1_analyzer, _exp1_analyzer_error

    if _exp1_analyzer is not None:
        return _exp1_analyzer

    if _exp1_analyzer_error is not None:
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
    disease_idx = detector.diseases.index(disease)

    localize_start = time.perf_counter()
    heatmap = localizer.get_heatmap(img_tensor, disease_idx)
    bboxes = localizer.heatmap_to_bboxes(heatmap)
    crops = localizer.crop_regions(image_path, bboxes)
    localize_ms = (time.perf_counter() - localize_start) * 1000.0

    finding_items: List[Dict[str, Any]] = []
    for crop in crops[:2]:
        bbox = crop["bbox"]
        finding_items.append(
            {
                "disease": disease,
                "confidence": float(confidence),
                "bbox": [int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])],
                "report": None,
            }
        )

    if not finding_items:
        finding_items.append(
            {
                "disease": disease,
                "confidence": float(confidence),
                "bbox": None,
                "report": None,
            }
        )

    analyzer = _get_exp1_analyzer_optional()
    analyzer_state = f"unavailable: {_exp1_analyzer_error}" if _exp1_analyzer_error else "unavailable"
    analysis_ms = 0.0
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
            finding_items[0]["report"] = analysis_text
            analyzer_state = "loaded"
        except Exception as ex:
            analyzer_state = f"error: {ex}"

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
            report = analyzer_text
            analyzer_state = "loaded"
        except Exception as ex:
            analyzer_state = f"error: {ex}"

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
        return _run_experiment2(image_path, patient_context)

    if mode == "both":
        exp2 = _run_experiment2(image_path, patient_context)
        try:
            exp1 = _run_experiment1(image_path, patient_context)
            best_conf = max(float(exp1.get("confidence", 0)), float(exp2.get("confidence", 0)))
            triage_color, priority = _priority_from_confidence(best_conf)
            return {
                "engine": "both",
                "status": "success",
                "findings": exp1.get("findings", []) + exp2.get("findings", []),
                "summary": f"Exp1: {exp1.get('summary', 'n/a')} | Exp2: {exp2.get('summary', 'n/a')}",
                "confidence": best_conf,
                "triageColor": triage_color,
                "priority": priority,
                "aiDraftReport": f"{exp1.get('aiDraftReport', '')}\n\n{exp2.get('aiDraftReport', '')}".strip(),
                "metadata": {"exp1": exp1.get("metadata", {}), "exp2": exp2.get("metadata", {})},
            }
        except Exception as ex:
            exp2["metadata"]["exp1_error"] = str(ex)
            return exp2

    # Default: experiment1
    return _run_experiment1(image_path, patient_context)


def _apply_analysis_to_case(db_case: Case, analysis: Dict[str, Any], db: Session) -> None:
    db_case.confidence = float(analysis.get("confidence", 0.0) or 0.0)
    db_case.triage_color = analysis.get("triageColor", "green")
    db_case.priority = analysis.get("priority", "routine")
    db_case.ai_draft_report = analysis.get("aiDraftReport")
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
            )
        )

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

    resolved_path = _resolve_image_path(db_case.image_path)
    if resolved_path and os.path.exists(resolved_path) and active_ai_model != "none":
        previous_confidence = float(db_case.confidence or 0.0)
        previous_report = db_case.ai_draft_report
        previous_complaint = db_case.complaint
        try:
            patient_context = f"{db_case.age}{db_case.sex}, complaint: {db_case.complaint}"
            analysis = _run_active_pipeline(resolved_path, patient_context)
            _apply_analysis_to_case(db_case, analysis, db)
            refreshed = db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 0).all()
            if not refreshed:
                synthetic_confidence = max(previous_confidence, float(analysis.get("confidence", 0.0) or 0.0))
                synthetic_disease = (
                    str(analysis.get("summary") or previous_complaint or "legacy finding").strip()[:100]
                )
                db.add(
                    Finding(
                        case_id=db_case.patient_id,
                        disease=synthetic_disease or "legacy finding",
                        confidence=synthetic_confidence,
                        bbox_x1=None,
                        bbox_y1=None,
                        bbox_x2=None,
                        bbox_y2=None,
                        report=str(analysis.get("aiDraftReport") or previous_report or ""),
                    )
                )
                db.commit()
        except Exception as ex:
            print(f"Legacy findings backfill failed for {patient_id}: {ex}")
            traceback.print_exc()
            _bootstrap_legacy_finding_if_possible(db_case, db)
    else:
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

# Routes

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
            timeReceived=c.time_received.strftime("%H:%M") if c.time_received else "00:00",
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
            timeReceived=c.time_received.strftime("%H:%M") if c.time_received else "00:00",
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

    # Auto-run analysis on case creation when image exists and AI is enabled.
    resolved_path = _resolve_image_path(db_case.image_path)
    if resolved_path and os.path.exists(resolved_path) and active_ai_model != "none":
        try:
            patient_context = f"{db_case.age}{db_case.sex}, complaint: {db_case.complaint}"
            analysis = _run_active_pipeline(resolved_path, patient_context)
            _apply_analysis_to_case(db_case, analysis, db)
            db.refresh(db_case)
        except Exception as ex:
            print(f"Auto-analysis failed for {db_case.patient_id}: {ex}")
            traceback.print_exc()
            db_case.ai_status = "ready"
            db_case.ai_draft_report = f"Analysis failed: {ex}"
            db.commit()

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


@app.get("/api/v1/escalations", response_model=List[EscalationSchema])
def get_escalations(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Escalation).filter(Escalation.is_deleted == 0)
    if status:
        query = query.filter(Escalation.status == status)
    db_esc = query.all()
    result = []
    for e in db_esc:
        result.append(EscalationSchema(
            patientId=e.patient_id,
            name=e.name,
            age=e.age,
            sex=e.sex,
            reasonForEscalation=e.reason_for_escalation,
            priority=e.priority,
            aiTriage=e.ai_triage,
            confidence=e.confidence,
            timeWaiting=e.time_waiting,
            status=e.status,
            assignedTo=e.assigned_to,
            specialistNotes=e.specialist_notes,
        ))
    return result

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
    db.commit()
    return get_escalations(db=db)[-1]  # roughly getting the mapped item back

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
    if esc.status is not None:
        db_esc.status = esc.status
    if esc.assignedTo is not None:
        db_esc.assigned_to = esc.assignedTo
    if esc.specialistNotes is not None:
        db_esc.specialist_notes = esc.specialistNotes
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
    analysis = _run_active_pipeline(image_path, patient_context)

    # Optional persistence for existing case
    patient_id = data.get("patientId")
    if patient_id:
        db_case = db.query(Case).filter(Case.patient_id == patient_id).order_by(Case.id.desc()).first()
        if db_case:
            _apply_analysis_to_case(db_case, analysis, db)

    return analysis

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

@app.post("/api/v1/chat")
def chat(data: Dict[Any, Any], db: Session = Depends(get_db)):
    message = str(data.get("message", "")).strip()
    patient_id = data.get("patientId")

    response = "AI Copilot Response"
    if patient_id:
        case_obj = db.query(Case).filter(Case.patient_id == patient_id, Case.is_deleted == 0).order_by(Case.id.desc()).first()
        findings = db.query(Finding).filter(Finding.case_id == patient_id, Finding.is_deleted == 0).all()
        if case_obj and findings:
            top = max(findings, key=lambda f: f.confidence)
            response = (
                f"Active model: {active_ai_model}. "
                f"Top finding for {patient_id}: {top.disease} ({top.confidence:.2f}). "
                f"Triage: {case_obj.triage_color}."
            )
            if top.report:
                response += f" Report snippet: {top.report[:400]}"
        elif case_obj and case_obj.ai_draft_report:
            response = f"Active model: {active_ai_model}. Draft report: {case_obj.ai_draft_report[:500]}"
        elif message:
            response = f"Active model is {active_ai_model}. No findings saved yet for {patient_id}."

    return {"response": response}

@app.post("/api/v1/upload")
async def upload_image(file: UploadFile = File(...)):
    # Save the file to .files directory
    files_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".files")
    os.makedirs(files_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(files_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"imagePath": f".files/{unique_filename}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
