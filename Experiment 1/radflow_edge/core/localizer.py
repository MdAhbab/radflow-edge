from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
import numpy as np
import cv2

class XRayLocalizer:
    def __init__(self, model):
        self.model = model
        self.target_layer = [model.features[-1]]
        # One GradCAM for the localizer's lifetime: each construction
        # registers forward/backward hooks on the model that are never
        # released, so per-call instances accumulate hooks and leak memory.
        self.cam = GradCAM(model=self.model, target_layers=self.target_layer)

    def get_heatmap(self, img_tensor, disease_index):
        targets = [ClassifierOutputTarget(disease_index)]
        return self.cam(input_tensor=img_tensor, targets=targets)[0]

    def heatmap_to_bboxes(self, heatmap, threshold=0.4):
        binary = (heatmap > threshold).astype(np.uint8)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        bboxes = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            if w > 15 and h > 15:
                bboxes.append((x, y, w, h))
        return bboxes

    def crop_regions(self, original_path, bboxes, padding=30):
        original = cv2.imread(original_path)
        orig_h, orig_w = original.shape[:2]
        scale_x = orig_w / 224
        scale_y = orig_h / 224
        crops = []
        for (x, y, w, h) in bboxes:
            x1 = max(0, int(x * scale_x) - padding)
            y1 = max(0, int(y * scale_y) - padding)
            x2 = min(orig_w, int((x+w) * scale_x) + padding)
            y2 = min(orig_h, int((y+h) * scale_y) + padding)
            crops.append({
                'image': original[y1:y2, x1:x2],
                'bbox': (x1, y1, x2, y2)
            })
        return crops
