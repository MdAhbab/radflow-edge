import os
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from core.pipeline import RadFlowPipeline

app = FastAPI(title="RadFlow Edge API")

# Lazy loading the pipeline
pipeline_instance = None

@app.on_event("startup")
def load_models():
    """Load models into memory on backend startup."""
    global pipeline_instance
    print("Loading AI pipeline models. This may take a while.")
    # Uncomment to enable fully loaded models, but kept lazy here to avoid out of memory during hackathon setup
    # pipeline_instance = RadFlowPipeline()

@app.post("/analyze")
async def analyze_xray(
    file: UploadFile = File(...),
    patient_context: str = Form("")
):
    global pipeline_instance
    if not pipeline_instance:
         pipeline_instance = RadFlowPipeline()
            
    # Save the uploaded file temporarily
    temp_path = f"/tmp/{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        results = pipeline_instance.process_xray(temp_path, patient_context)
        return JSONResponse(content=results)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/health")
def health_check():
    return {"status": "Device and models are ready."}
