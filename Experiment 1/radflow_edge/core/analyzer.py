from transformers import AutoModelForCausalLM, AutoProcessor, BitsAndBytesConfig
import torch
from PIL import Image
import cv2
import os

class CheXagentAnalyzer:
    def __init__(self, model_id="StanfordAIMI/CheXagent-8b", device=None):
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        
        # Strictly use workspace-relative path for portability
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        local_model_path = os.path.join(base_dir, "models", "chexagent")
        
        if not os.path.exists(local_model_path):
             raise FileNotFoundError(
                f"Model not found in {local_model_path}. "
                "Please run `python Experiment 1/radflow_edge/download_models.py` first."
            )

        # Use 4-bit quantization for memory efficiency
        self.bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16
        )

        print(f"Loading CheXagent-8b from: {local_model_path}")
        self.processor = AutoProcessor.from_pretrained(local_model_path, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            local_model_path,
            quantization_config=self.bnb_config,
            device_map='auto',
            trust_remote_code=True
        )
        self.model.eval()

    def analyze(self, crop_img, disease_hint, patient_context='', rag_context=''):
        pil = Image.fromarray(cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB))
        prompt = f'''You are a radiology assistant.
Patient: {patient_context}
CNN finding: {disease_hint}
Guidelines: {rag_context}

Analyze this X-ray region. Provide:
FINDING: what you see
CONFIRM: yes/no for {disease_hint}
SEVERITY: mild/moderate/severe
LOCATION: anatomical description
ACTION: immediate recommendation'''

        inputs = self.processor(images=pil, text=prompt, return_tensors='pt').to('cuda' if torch.cuda.is_available() else 'cpu')
        
        with torch.no_grad():
            out = self.model.generate(**inputs, max_new_tokens=300)
            
        return self.processor.decode(out[0], skip_special_tokens=True)
