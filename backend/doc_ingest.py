"""Document intake: OCR a prescription/report/lab-slip photo, then have
the local model extract structured fields — strictly grounded.

Tesseract (Bangla + English traineddata) does the raw OCR offline; the
multimodal model then both reads the image and the OCR text to extract
medicines, conditions, and history. Extraction is strictly extractive:
fields not present in the document come back null and are flagged for
manual entry — never hallucinated.
"""

import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DocumentFields(BaseModel):
    document_type: Optional[str] = None  # prescription | lab_report | discharge | other
    medicines: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    history_notes: Optional[str] = None
    provider_or_facility: Optional[str] = None
    document_date: Optional[str] = None


def ocr_image(image_path: str, languages: str = "ben+eng") -> str:
    """Raw OCR text from a document photo. Returns '' on failure."""
    try:
        import pytesseract
        from PIL import Image

        img = Image.open(image_path)
        return pytesseract.image_to_string(img, lang=languages).strip()
    except Exception:
        # Fall back to English-only if Bangla traineddata is missing.
        try:
            import pytesseract
            from PIL import Image

            return pytesseract.image_to_string(Image.open(image_path), lang="eng").strip()
        except Exception:
            return ""


EXTRACT_PROMPT = (
    "You are a medical records clerk. You are given the OCR text of a "
    "scanned medical document (prescription, lab report, or discharge "
    "summary), possibly in Bangla or English.\n\n"
    "Extract ONLY information explicitly present. Never infer or invent. "
    "Use null / empty list for anything not stated.\n\n"
    "Reply with a single JSON object and nothing else:\n"
    "{\n"
    '  "document_type": "prescription"|"lab_report"|"discharge"|"other"|null,\n'
    '  "medicines": [str], "conditions": [str], "allergies": [str],\n'
    '  "history_notes": str|null, "provider_or_facility": str|null,\n'
    '  "document_date": str|null\n'
    "}\n\n"
    "OCR TEXT:\n"
)


def parse_extraction(raw: str) -> Dict[str, Any]:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)
    import json

    parsed = json.loads(text)
    fields = DocumentFields(**{k: v for k, v in parsed.items() if k in DocumentFields.model_fields})
    return fields.model_dump()


def merge_into_record(existing: Dict[str, Any], extracted: Dict[str, Any]) -> Dict[str, Any]:
    """Additively fold extracted document fields into a patient record
    without overwriting existing clinician-entered data."""
    updates: Dict[str, Any] = {}

    new_meds = [m for m in extracted.get("medicines", []) if m]
    new_conditions = [c for c in extracted.get("conditions", []) if c]
    extra_notes = []

    if new_meds:
        extra_notes.append("Medicines (from document): " + ", ".join(new_meds))
    if new_conditions:
        extra_notes.append("Conditions (from document): " + ", ".join(new_conditions))
    if extracted.get("allergies"):
        extra_notes.append("Allergies (from document): " + ", ".join(extracted["allergies"]))
    if extracted.get("history_notes"):
        extra_notes.append(str(extracted["history_notes"]))

    if extra_notes:
        prior = (existing.get("clinical_notes") or "").strip()
        addition = "\n".join(extra_notes)
        updates["clinical_notes"] = (prior + "\n" + addition).strip() if prior else addition

    if new_conditions:
        prior_rf = (existing.get("risk_factors") or "").strip()
        rf_addition = ", ".join(new_conditions)
        updates["risk_factors"] = (prior_rf + ", " + rf_addition).strip(", ") if prior_rf else rf_addition

    return updates
