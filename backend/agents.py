"""Agentic workflows for RadFlow-Edge — all on the local model.

Four agents, each a small explicit graph rather than a free-roaming
multi-agent swarm (deliberate, to keep the edge footprint and latency
predictable on an 8GB device):

1. TriageReasonerAgent — LangGraph StateGraph: retrieve guidelines ->
   reason over detector+vitals -> assign risk -> decide escalation. Every
   transition is an explicit node so the reasoning is auditable.
2. MorningBriefingAgent — summarises the overnight worklist and proposes a
   prioritised review order for the clinician.
3. EscalationDrafterAgent — drafts a specialist referral note for a case.
4. IntakeScribeAgent — voice/document -> structured fields (typed output
   validated with Pydantic). Implemented in voice_intake / doc_ingest;
   re-exported here so all agents live behind one registry.

The LangGraph dependency is used where it earns its place (the multi-step
triage graph); the simpler agents are single prompted calls and say so.
"""

import json
import os
from typing import Any, Callable, Dict, List, Optional, TypedDict


# --------------------------------------------------------------------------
# 1. Triage Reasoner — LangGraph multi-step graph
# --------------------------------------------------------------------------
class TriageState(TypedDict, total=False):
    disease: str
    confidence: float
    patient_context: str
    vitals: Dict[str, Any]
    guidelines: str
    citations: List[str]
    reasoning: str
    risk_band: str
    risk_rationale: List[str]
    decision: str  # route | escalate | monitor


def build_triage_graph(
    retrieve_fn: Callable[[str, str], tuple],
    llm_fn: Callable[[str], str],
    risk_fn: Callable[[Dict[str, Any], float], Any],
):
    """Compile the triage reasoning graph. Dependencies are injected so the
    graph stays testable without the FastAPI app."""
    from langgraph.graph import END, START, StateGraph

    def retrieve_node(state: TriageState) -> TriageState:
        block, citations = retrieve_fn(state["disease"], state.get("patient_context", ""))
        return {"guidelines": block, "citations": citations}

    def risk_node(state: TriageState) -> TriageState:
        result = risk_fn(state.get("vitals", {}), state.get("confidence", 0.0))
        return {"risk_band": result.risk_band, "risk_rationale": result.rationale}

    def reason_node(state: TriageState) -> TriageState:
        prompt = (
            "You are a triage reasoner at a rural clinic. Using ONLY the case "
            "facts and guidelines, give a 2-3 sentence clinical assessment and "
            "cite guidelines inline as [SOURCE-ID].\n\n"
            f"Finding: {state['disease']} (confidence {state.get('confidence', 0):.0%})\n"
            f"Patient: {state.get('patient_context', 'n/a')}\n"
            f"Deterioration risk: {state.get('risk_band', 'unknown')} "
            f"({'; '.join(state.get('risk_rationale', []))})\n\n"
            f"Guidelines:\n{state.get('guidelines', 'none')}"
        )
        return {"reasoning": llm_fn(prompt)}

    def decide_node(state: TriageState) -> TriageState:
        band = state.get("risk_band", "low")
        conf = state.get("confidence", 0.0)
        if band == "high" or conf >= 0.8:
            decision = "escalate"
        elif band == "moderate" or conf >= 0.5:
            decision = "monitor"
        else:
            decision = "route"
        return {"decision": decision}

    graph = StateGraph(TriageState)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("risk", risk_node)
    graph.add_node("reason", reason_node)
    graph.add_node("decide", decide_node)
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "risk")
    graph.add_edge("risk", "reason")
    graph.add_edge("reason", "decide")
    graph.add_edge("decide", END)
    return graph.compile()


def run_triage_reasoner(
    disease: str,
    confidence: float,
    patient_context: str,
    vitals: Dict[str, Any],
    retrieve_fn: Callable[[str, str], tuple],
    llm_fn: Callable[[str], str],
    risk_fn: Callable[[Dict[str, Any], float], Any],
) -> Dict[str, Any]:
    app = build_triage_graph(retrieve_fn, llm_fn, risk_fn)
    final = app.invoke(
        {
            "disease": disease,
            "confidence": confidence,
            "patient_context": patient_context,
            "vitals": vitals,
        }
    )
    return {
        "reasoning": final.get("reasoning", ""),
        "citations": final.get("citations", []),
        "riskBand": final.get("risk_band", "low"),
        "riskRationale": final.get("risk_rationale", []),
        "decision": final.get("decision", "route"),
    }


# --------------------------------------------------------------------------
# 2. Morning Briefing Agent — prioritise the overnight queue
# --------------------------------------------------------------------------
def run_morning_briefing(cases: List[Dict[str, Any]], llm_fn: Callable[[str], str]) -> str:
    if not cases:
        return "No pending cases in the worklist. Queue is clear."
    summary = [
        {
            "patientId": c.get("patientId"),
            "triage": c.get("triageColor"),
            "confidence": c.get("confidence"),
            "complaint": (c.get("complaint") or "")[:80],
            "status": c.get("aiStatus"),
        }
        for c in cases[:25]
    ]
    prompt = (
        "You are the charge nurse's morning assistant at a rural clinic. "
        "Given the overnight worklist JSON, write a short briefing: (1) one-line "
        "queue summary with counts by triage colour, (2) a prioritised review "
        "order of the 3-5 most urgent patients with a one-line reason each. "
        "Be concise and practical.\n\n"
        f"WORKLIST:\n{json.dumps(summary, ensure_ascii=True)}"
    )
    return llm_fn(prompt)


# --------------------------------------------------------------------------
# 3. Escalation Drafter Agent — specialist referral note
# --------------------------------------------------------------------------
def run_escalation_drafter(case_context: Dict[str, Any], llm_fn: Callable[[str], str]) -> str:
    prompt = (
        "Draft a concise specialist referral note for the radiologist on call. "
        "Use this structure: REASON FOR REFERRAL, KEY FINDINGS, RELEVANT VITALS & "
        "HISTORY, SPECIFIC QUESTION FOR SPECIALIST. Base it strictly on the case "
        "context; do not invent data.\n\n"
        f"CASE CONTEXT (JSON):\n{json.dumps(case_context, ensure_ascii=True)}"
    )
    return llm_fn(prompt)


# --------------------------------------------------------------------------
# 4. Intake Scribe Agent — typed extraction (Pydantic-validated)
#    The pipeline lives in voice_intake.py / doc_ingest.py; this is a thin
#    Pydantic-AI-style typed wrapper used when pydantic_ai is available.
# --------------------------------------------------------------------------
def extract_intake_typed(transcript: str, llm_json_fn: Callable[[str], str]) -> Dict[str, Any]:
    """Typed intake extraction validated by the VoiceIntakeFields model."""
    from voice_intake import VoiceIntakeFields

    prompt = (
        "Extract patient intake fields from the transcript as strict JSON "
        "(keys: name, age, sex, complaint, vital_temp, vital_hr, vital_bp, "
        "vital_resp, vital_spo2, vital_weight, risk_factors, clinical_notes). "
        f"Use null for unstated.\n\nTRANSCRIPT:\n{transcript}"
    )
    raw = llm_json_fn(prompt)
    import re

    brace = re.search(r"\{.*\}", raw, re.DOTALL)
    parsed = json.loads(brace.group(0)) if brace else {}
    fields = VoiceIntakeFields(**{k: v for k, v in parsed.items() if k in VoiceIntakeFields.model_fields})
    dump = fields.model_dump()
    return {"fields": dump, "needs_input": [k for k, v in dump.items() if v is None]}


AGENT_REGISTRY = {
    "triage_reasoner": "LangGraph multi-step: retrieve -> risk -> reason -> decide",
    "morning_briefing": "Summarise overnight worklist + prioritised review order",
    "escalation_drafter": "Draft specialist referral note from case context",
    "intake_scribe": "Voice/document -> typed, Pydantic-validated patient fields",
}
