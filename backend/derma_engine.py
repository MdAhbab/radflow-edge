"""Dermatology triage: EfficientNet-B3 skin-lesion classifier.

A second imaging pipeline for community health workers: photograph a skin
lesion, get a triage band. The backbone is EfficientNet-B3 (timm); the
classification head targets the common ISIC-style categories. Without a
fine-tuned checkpoint the model runs ImageNet-pretrained as a feature
extractor and the head returns calibrated-but-uncalibrated logits — the
pipeline is structurally complete and a fine-tuned `models/derma_b3.pt`
drops in when training data is available (see continual_learning.py).

Runs under the same single-model execution slot as the X-ray pipeline, so
it never competes with the chest pipeline or the local LLM for memory.
"""

import os
from dataclasses import dataclass
from typing import Dict, List, Optional

# ISIC-style lesion categories with their clinical urgency.
LESION_CLASSES = [
    ("melanoma", "high", "Malignant melanoma — urgent dermatology referral."),
    ("basal_cell_carcinoma", "high", "Basal cell carcinoma — refer for excision."),
    ("actinic_keratosis", "moderate", "Pre-malignant; monitor and refer if changing."),
    ("benign_nevus", "low", "Benign mole; reassure, safety-net advice."),
    ("seborrheic_keratosis", "low", "Benign; no action unless symptomatic."),
    ("dermatofibroma", "low", "Benign; reassure."),
    ("vascular_lesion", "low", "Usually benign; refer if atypical."),
]

CKPT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "derma_b3.pt"
)


@dataclass
class DermaResult:
    label: str
    confidence: float
    triage_band: str
    advice: str
    differential: List[Dict[str, float]]
    fine_tuned: bool


class DermaClassifier:
    def __init__(self) -> None:
        self._model = None
        self._transform = None
        self._fine_tuned = False

    def _ensure_model(self):
        if self._model is not None:
            return
        import timm
        import torch

        num_classes = len(LESION_CLASSES)
        model = timm.create_model("efficientnet_b3", pretrained=not os.path.exists(CKPT_PATH), num_classes=num_classes)
        if os.path.exists(CKPT_PATH):
            state = torch.load(CKPT_PATH, map_location="cpu")
            model.load_state_dict(state)
            self._fine_tuned = True
        model.eval()
        self._model = model

        from torchvision import transforms

        self._transform = transforms.Compose(
            [
                transforms.Resize((300, 300)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    def classify(self, image_path: str) -> DermaResult:
        self._ensure_model()
        import torch
        from PIL import Image

        img = Image.open(image_path).convert("RGB")
        x = self._transform(img).unsqueeze(0)
        with torch.no_grad():
            logits = self._model(x)
            probs = torch.softmax(logits, dim=1)[0]

        ranked = sorted(
            range(len(LESION_CLASSES)), key=lambda i: float(probs[i]), reverse=True
        )
        top = ranked[0]
        label, band, advice = LESION_CLASSES[top]
        differential = [
            {"label": LESION_CLASSES[i][0], "confidence": round(float(probs[i]), 3)}
            for i in ranked[:3]
        ]
        return DermaResult(
            label=label,
            confidence=round(float(probs[top]), 3),
            triage_band=band,
            advice=advice,
            differential=differential,
            fine_tuned=self._fine_tuned,
        )


_CLASSIFIER: Optional[DermaClassifier] = None


def get_derma_classifier() -> DermaClassifier:
    global _CLASSIFIER
    if _CLASSIFIER is None:
        _CLASSIFIER = DermaClassifier()
    return _CLASSIFIER
