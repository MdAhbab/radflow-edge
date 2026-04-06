import os
import shutil
import uuid
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from database import SessionLocal, Case, Finding, Escalation, SystemStats

app = FastAPI(title="HSIL Hackathon API")

# Global state for active AI model
active_ai_model = os.getenv("HSIL_PIPELINE_MODE", "experiment1")

# Setup StaticFiles for uploaded/copied images
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files_dir = os.path.join(BASE_DIR, ".files")
os.makedirs(files_dir, exist_ok=True)
app.mount("/.files", StaticFiles(directory=files_dir), name="files")

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
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"CRITICAL ERROR: {exc}")
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )

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

class EscalationCreateSchema(EscalationBase):
    patientId: str

class EscalationSchema(EscalationBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    patientId: str

class EscalationUpdateSchema(BaseModel):
    status: Optional[str] = None
    assignedTo: Optional[str] = None

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

# Routes

@app.get("/api/v1/cases", response_model=List[CaseFrontendSchema])
def get_cases(history: Optional[bool] = False, status: Optional[str] = None, triage: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Case)
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
    base_q = db.query(Case).filter(Case.is_archived == 0)
    total = base_q.count()
    new_cases = base_q.filter(Case.ai_status == "ready").count()
    urgent = base_q.filter(Case.priority.in_(["High Priority", "urgent", "immediate"])).count()
    escalated = base_q.filter(Case.ai_status == "escalated").count()
    completed = base_q.filter(Case.ai_status == "complete").count()
    return {"newCases": new_cases, "urgentCases": urgent, "escalatedCases": escalated, "completedToday": completed, "totalCases": total}

@app.get("/api/v1/system/status")
def get_system_status():
    return {
        "status": "online",
        "active_model": active_ai_model,
        "uptime": "5d 14h 22m",
        "cpu_usage": 42.5,
        "memory_usage": 68.2,
        "active_users": 15,
        "running_processes": [
            {"name": "RadFlow Engine", "status": "running", "cpu": 15.2, "mem": 1024},
            {"name": "DICOM Receiver", "status": "running", "cpu": 2.1, "mem": 256},
            {"name": "Model Server (GPU 0)", "status": "running", "cpu": 18.5, "mem": 4096},
            {"name": "DB Sync Service", "status": "idle", "cpu": 0.1, "mem": 64}
        ],
        "queue_length": 8,
        "estimated_wait_time": "1m 30s",
        "recent_errors": 0
    }

@app.get("/api/v1/system/model")
def get_active_model():
    return {"modelId": active_ai_model}

@app.post("/api/v1/system/model")
def set_active_model(data: Dict[str, str]):
    global active_ai_model
    new_model = data.get("modelId")
    if not new_model:
        raise HTTPException(status_code=400, detail="modelId required")
    active_ai_model = new_model
    return {"status": "success", "activeModel": active_ai_model}

@app.get("/api/v1/cases/{patient_id}", response_model=CaseFrontendSchema)
def get_case(patient_id: str, db: Session = Depends(get_db)):
    # Order by ID descending to get the most recent visit first
    c = db.query(Case).filter(Case.patient_id == patient_id).order_by(Case.id.desc()).first()
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
    # Re-fetch as the Frontend Schema to ensure proper serialization
    return get_case(db_case.patient_id, db=db)

@app.put("/api/v1/cases/{patient_id}")
def update_case(patient_id: str, case: CaseUpdateSchema, db: Session = Depends(get_db)):
    db_case = db.query(Case).filter(Case.patient_id == patient_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")
    update_data = case.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_case, key, value)
    db.commit()
    return {"status": "updated"}


@app.get("/api/v1/escalations", response_model=List[EscalationSchema])
def get_escalations(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Escalation)
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
            assignedTo=e.assigned_to
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
    
    db_esc = Escalation(**data)
    db.add(db_esc)
    db.commit()
    return get_escalations(db=db)[-1]  # roughly getting the mapped item back

@app.get("/api/v1/escalations/stats")
def get_escalation_stats(db: Session = Depends(get_db)):
    awaiting = db.query(Escalation).filter(Escalation.status == "awaiting").count()
    in_review = db.query(Escalation).filter(Escalation.status == "in-review").count()
    returned = db.query(Escalation).filter(Escalation.status == "returned").count()
    finalized = db.query(Escalation).filter(Escalation.status == "finalized").count()
    return {"awaiting": awaiting, "inReview": in_review, "returned": returned, "finalized": finalized}

@app.put("/api/v1/escalations/{patient_id}")
def update_escalation(patient_id: str, esc: EscalationUpdateSchema, db: Session = Depends(get_db)):
    db_esc = db.query(Escalation).filter(Escalation.patient_id == patient_id).first()
    if not db_esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    if esc.status is not None:
        db_esc.status = esc.status
    if esc.assignedTo is not None:
        db_esc.assigned_to = esc.assignedTo
    db.commit()
    return {"status": "updated"}

@app.get("/api/v1/findings/{patient_id}", response_model=List[FindingSchema])
def get_findings(patient_id: str, db: Session = Depends(get_db)):
    return db.query(Finding).filter(Finding.case_id == patient_id).all()

@app.post("/api/v1/findings/{patient_id}")
def create_finding(patient_id: str, finding: FindingSchema, db: Session = Depends(get_db)):
    fnd = Finding(**finding.model_dump())
    fnd.case_id = patient_id
    db.add(fnd)
    db.commit()
    return {"status": "saved"}

# AI Models (Mocks just to fulfill endpoints in REBUILD_GUIDE.md)
@app.post("/api/v1/analyze")
def analyze_xray(data: Dict[Any, Any]):
    return {"status": "analyzed", "findings": []}

@app.post("/api/v1/foveal")
def foveal_preprocess(data: Dict[Any, Any]):
    return {"status": "preprocessed"}

@app.post("/api/v1/chat")
def chat(data: Dict[Any, Any]):
    return {"response": "AI Copilot Response"}

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
