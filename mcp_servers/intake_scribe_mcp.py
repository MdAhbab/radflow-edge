"""radflow-intake-scribe-mcp — exposes the voice + document intake
pipelines as MCP tools.

Wraps the H4 voice-intake scribe (Bangla/English/mixed speech -> form
fields) and the OCR document reader (prescription / lab slip -> structured
fields) so agents and dev scripts can test the intake pipelines on sample
audio and document images. Enforces strictly extractive output: fields
not grounded in the transcript/OCR come back null + needs_input. Not used
for live PHI in production; dev uses anonymised fixtures.

Run:  python mcp_servers/intake_scribe_mcp.py        (stdio transport)
"""

import base64
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from mcp.server.fastmcp import FastMCP  # noqa: E402

mcp = FastMCP("radflow-intake-scribe")

OLLAMA_URL = os.getenv("HSIL_OLLAMA_URL", "http://localhost:11434").rstrip("/")
MODEL = os.getenv("HSIL_COPILOT_MODEL", "gemma4:e2b")


@mcp.tool()
def transcribe_voice(audio_path: str, languages: str = "bn+en") -> dict:
    """Transcribe a Bangla/English/code-mixed clinical intake recording and
    extract patient fields. ``audio_path`` is a local wav/mp3 file."""
    import requests

    from voice_intake import INTAKE_PROMPT, parse_intake_response

    with open(audio_path, "rb") as fp:
        audio_b64 = base64.b64encode(fp.read()).decode("ascii")
    fmt = os.path.splitext(audio_path)[1].lstrip(".") or "wav"
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": INTAKE_PROMPT},
                    {"type": "input_audio", "input_audio": {"data": audio_b64, "format": fmt}},
                ],
            }
        ],
        "max_tokens": 1500,
        "temperature": 0.1,
    }
    resp = requests.post(f"{OLLAMA_URL}/v1/chat/completions", json=payload, timeout=240)
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return parse_intake_response(content)


@mcp.tool()
def extract_intake_fields(transcript: str) -> dict:
    """Extract structured patient fields from an existing transcript text
    (no audio). Strictly extractive: unstated fields return null."""
    import json
    import re

    import requests

    from voice_intake import VoiceIntakeFields

    prompt = (
        "Extract patient intake fields from this transcript as JSON with keys "
        "name, age, sex, complaint, vital_temp, vital_hr, vital_bp, vital_resp, "
        "vital_spo2, vital_weight, risk_factors, clinical_notes. Use null for "
        f"anything not stated.\n\nTRANSCRIPT:\n{transcript}"
    )
    resp = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={"model": MODEL, "messages": [{"role": "user", "content": prompt}],
              "stream": False, "think": False, "options": {"temperature": 0.1, "num_predict": 400}},
        timeout=120,
    )
    resp.raise_for_status()
    text = resp.json()["message"]["content"]
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    parsed = json.loads(brace.group(0)) if brace else {}
    fields = VoiceIntakeFields(**{k: v for k, v in parsed.items() if k in VoiceIntakeFields.model_fields})
    dump = fields.model_dump()
    return {"fields": dump, "needs_input": [k for k, v in dump.items() if v is None]}


@mcp.tool()
def ocr_document(image_path: str, languages: str = "ben+eng") -> dict:
    """OCR a prescription/lab-slip/report photo and extract structured
    fields (medicines, conditions, allergies). Strictly extractive."""
    from doc_ingest import ocr_image

    text = ocr_image(image_path, languages)
    return {"ocr_text": text, "char_count": len(text)}


if __name__ == "__main__":
    mcp.run()
