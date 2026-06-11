"""Voice intake scribe: spoken patient details -> structured form fields.

The local multimodal LLM transcribes Bangla / English / code-mixed
speech and extracts intake fields in a single pass — no separate ASR
model, which matters on an 8GB edge device. Extraction is strictly
grounded: fields the speaker did not state come back null and the UI
flags them for manual entry. A clinician always reviews before save.

Shared by the FastAPI endpoint and the intake-scribe MCP server.
"""

import json
import re
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class VoiceIntakeFields(BaseModel):
    """Typed, validated payload the form auto-fill is allowed to use."""

    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    sex: Optional[str] = None
    complaint: Optional[str] = None
    vital_temp: Optional[float] = Field(None, ge=80, le=115)
    vital_hr: Optional[int] = Field(None, ge=20, le=300)
    vital_bp: Optional[str] = None
    vital_resp: Optional[int] = Field(None, ge=4, le=90)
    vital_spo2: Optional[float] = Field(None, ge=40, le=100)
    vital_weight: Optional[float] = Field(None, ge=1, le=400)
    risk_factors: Optional[str] = None
    clinical_notes: Optional[str] = None

    @field_validator("sex", mode="before")
    @classmethod
    def _normalize_sex(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip().lower()
        if s in {"m", "male", "পুরুষ"}:
            return "M"
        if s in {"f", "female", "মহিলা", "নারী"}:
            return "F"
        return str(v)[:16]

    @field_validator("risk_factors", mode="before")
    @classmethod
    def _join_lists(cls, v: Any) -> Optional[str]:
        if isinstance(v, (list, tuple)):
            return ", ".join(str(x) for x in v if x) or None
        return v


INTAKE_PROMPT = (
    "You are a clinical intake scribe at a rural health centre in Bangladesh. "
    "The recording may be in Bangla, English, or a mix of both.\n\n"
    "1. Transcribe the recording in the language(s) actually spoken.\n"
    "2. Extract intake fields from ONLY what was said. Never guess or invent "
    "a value; use null for anything not stated. Translate clinical content "
    "to English in the fields, keeping the transcript in the original language.\n\n"
    "Answer with a single JSON object and nothing else:\n"
    "{\n"
    '  "transcript": "verbatim transcription",\n'
    '  "fields": {\n'
    '    "name": str|null, "age": int|null, "sex": "M"|"F"|null,\n'
    '    "complaint": str|null,\n'
    '    "vital_temp": float Fahrenheit|null, "vital_hr": int|null,\n'
    '    "vital_bp": "systolic/diastolic"|null, "vital_resp": int|null,\n'
    '    "vital_spo2": float|null, "vital_weight": float kg|null,\n'
    '    "risk_factors": str|null, "clinical_notes": str|null\n'
    "  }\n"
    "}"
)


def parse_intake_response(raw: str) -> Dict[str, Any]:
    """Parse the model's reply into {transcript, fields, missing_fields}.

    Tolerates markdown fences and leading prose; raises ValueError when no
    JSON object can be recovered so callers can surface a clean error.
    """
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        if brace:
            text = brace.group(0)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as ex:
        raise ValueError(f"Model reply was not valid JSON: {ex}") from ex

    raw_fields = parsed.get("fields") or {}
    fields = VoiceIntakeFields(**{k: v for k, v in raw_fields.items() if k in VoiceIntakeFields.model_fields})
    field_dump = fields.model_dump()
    missing = [k for k, v in field_dump.items() if v is None]

    return {
        "transcript": str(parsed.get("transcript") or "").strip(),
        "fields": field_dump,
        "missing_fields": missing,
    }
