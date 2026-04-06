from sqlalchemy import Column, Integer, String, Float, DateTime, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'radflow.db')}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String(50), index=True)
    name = Column(String(200))
    age = Column(Integer)
    sex = Column(String(1))
    complaint = Column(Text)
    study_type = Column(String(100), default="Chest X-Ray (PA)")
    time_received = Column(DateTime, default=datetime.utcnow)
    ai_status = Column(String(20), default="ready")
    triage_color = Column(String(10), default="green")
    confidence = Column(Float, default=0)
    priority = Column(String(100), nullable=True)
    image_path = Column(String(500), nullable=True)
    
    # Vital Signs
    vital_temp = Column(Float, nullable=True)
    vital_hr = Column(Integer, nullable=True)
    vital_bp = Column(String(20), nullable=True)
    vital_resp = Column(Integer, nullable=True)
    vital_spo2 = Column(Float, nullable=True)
    vital_weight = Column(Float, nullable=True)
    
    # Clinical History / Details
    risk_factors = Column(Text, nullable=True) 
    clinical_notes = Column(Text, nullable=True)
    differential_diagnosis = Column(Text, nullable=True) 
    recommended_steps = Column(Text, nullable=True) 
    ai_draft_report = Column(Text, nullable=True)
    
    is_archived = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(50), index=True)
    disease = Column(String(100))
    confidence = Column(Float)
    bbox_x1 = Column(Integer, nullable=True)
    bbox_y1 = Column(Integer, nullable=True)
    bbox_x2 = Column(Integer, nullable=True)
    bbox_y2 = Column(Integer, nullable=True)
    report = Column(Text, nullable=True)
    severity = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String(50), index=True)
    name = Column(String(200))
    age = Column(Integer)
    sex = Column(String(1))
    reason_for_escalation = Column(Text)
    priority = Column(String(20), default="routine")
    ai_triage = Column(String(10), default="yellow")
    confidence = Column(Float, default=0)
    time_waiting = Column(String(20), default="0h 0m")
    status = Column(String(20), default="awaiting")
    assigned_to = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SystemStats(Base):
    __tablename__ = "system_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, default=datetime.utcnow)
    new_cases = Column(Integer, default=0)
    urgent_cases = Column(Integer, default=0)
    escalated_cases = Column(Integer, default=0)
    completed_cases = Column(Integer, default=0)
    total_analyzed = Column(Integer, default=0)

# Create all tables
Base.metadata.create_all(bind=engine)
