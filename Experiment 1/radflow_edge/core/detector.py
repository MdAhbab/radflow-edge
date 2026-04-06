import torch
import torchxrayvision as xrv
import numpy as np
import cv2
import pydicom
import os

class XRayDetector:
    def __init__(self, model_name="densenet121-res224-all", device=None):
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        
        # Strictly use workspace-relative path for portability
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        local_models_root = os.path.join(base_dir, "models", "xrv")
        local_weights_dir = os.path.join(local_models_root, "models_data")
        
        if not os.path.exists(local_weights_dir):
            raise FileNotFoundError(
                f"Model weights not found in {local_weights_dir}. "
                "Please run `python Experiment 1/radflow_edge/download_models.py` first."
            )
            
        # Override torchxrayvision's cache to our local models folder
        os.environ["TORCH_XRAYVISION_CACHE"] = local_models_root
        print(f"Loading DenseNet weights from: {local_weights_dir}")
            
        self.model = xrv.models.DenseNet(weights=model_name).to(self.device)
        self.model.eval()
        self.diseases = self.model.pathologies

    def load_image(self, path):
        if path.endswith('.dcm'):
            dcm = pydicom.dcmread(path)
            img = dcm.pixel_array.astype(float)
        else:
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE).astype(float)
            
        img = xrv.datasets.normalize(img, 255)
        img = cv2.resize(img, (224, 224))
        return torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)

    def detect(self, image_path, threshold=0.3):
        img_tensor = self.load_image(image_path)
        with torch.no_grad():
            preds = self.model(img_tensor)
        findings = {}
        for i, disease in enumerate(self.diseases):
            score = float(preds[0][i])
            if score > threshold:
                findings[disease] = round(score, 3)
        return dict(sorted(findings.items(), key=lambda x: x[1], reverse=True)), img_tensor
