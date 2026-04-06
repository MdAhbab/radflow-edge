import os
import sys
from datetime import datetime, timedelta

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, engine, Base, Case, Finding

def populate_extra():
    db = SessionLocal()
    try:
        # Get list of existing images in .files folder
        files_dir = "C:/Users/ahbab/Downloads/HSIL_Hackathon/.files"
        available_images = [f for f in os.listdir(files_dir) if f.startswith("bd_sim_")]
        
        if not available_images:
            print("No bd_sim images found in .files. Skipping population.")
            return

        extra_cases = [
            {
                "patient_id": "PT-BD-MONIR-1",
                "name": "Monir Hussain",
                "age": 45,
                "sex": "M",
                "complaint": "Persistent cough for 3 weeks and evening fever",
                "triage_color": "orange",
                "priority": "urgent",
                "ai_status": "ready"
            },
            {
                "patient_id": "PT-BD-FATEMA-1",
                "name": "Fatema Khatun",
                "age": 28,
                "sex": "F",
                "complaint": "Sudden onset sharp chest pain on the left side",
                "triage_color": "red",
                "priority": "immediate",
                "ai_status": "escalated"
            },
             {
                "patient_id": "PT-BD-ARIF-1",
                "name": "Arif Ahmed",
                "age": 62,
                "sex": "M",
                "complaint": "Difficulty breathing on exertion, weight loss",
                "triage_color": "orange",
                "priority": "urgent",
                "ai_status": "ready"
            },
            {
                "patient_id": "PT-BD-HASAN-1",
                "name": "Hasan Mahmud",
                "age": 50,
                "sex": "M",
                "complaint": "Productive cough and high grade fever for 4 days",
                "triage_color": "yellow",
                "priority": "routine",
                "ai_status": "complete",
                "is_archived": 0
            },
            {
                "patient_id": "PT-BD-NUR-1",
                "name": "Nur Jahan",
                "age": 35,
                "sex": "F",
                "complaint": "History of tuberculosis exposure, routine checkup",
                "triage_color": "green",
                "priority": "routine",
                "ai_status": "complete",
                "is_archived": 1
            }
        ]

        for i, case_info in enumerate(extra_cases):
            # Rotate through available images
            img_name = available_images[i % len(available_images)]
            
            c = Case(
                patient_id=case_info["patient_id"],
                name=case_info["name"],
                age=case_info["age"],
                sex=case_info["sex"],
                complaint=case_info["complaint"],
                study_type="Chest X-Ray (PA)",
                time_received=datetime.utcnow() - timedelta(minutes=15 * (i+1)),
                ai_status=case_info["ai_status"],
                triage_color=case_info["triage_color"],
                confidence=0.75 + (i * 0.05),
                priority=case_info["priority"],
                image_path=f".files/{img_name}",
                is_archived=case_info.get("is_archived", 0)
            )
            db.add(c)
        
        db.commit()
        print(f"Successfully populated {len(extra_cases)} extra Bangladeshi cases.")
    except Exception as e:
        db.rollback()
        print(f"Error during population: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    populate_extra()
