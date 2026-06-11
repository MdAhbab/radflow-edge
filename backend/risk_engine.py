"""Deterioration risk scoring: qSOFA rule engine + XGBoost model + SHAP.

Two complementary signals, both fully offline:

1. ``qsofa_score`` — the deterministic Sepsis-3 bedside rule. Transparent,
   guideline-traceable (see knowledge_base/sepsis_qsofa.md), never a
   black box. This is the safety floor.

2. ``RiskModel`` — a small gradient-boosted model over vitals + age +
   detector confidence that estimates probability of deterioration, with
   per-prediction SHAP attributions so every score carries a "why". The
   model trains on synthetic-but-clinically-shaped data at first run and
   is overwritten by the nightly continual-learning job once real
   confirmed outcomes accumulate.

The model never overrides the rule engine: final triage takes the more
conservative (higher-acuity) of the two.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "risk_xgb.json"
)

FEATURES = [
    "age",
    "vital_temp",
    "vital_hr",
    "vital_resp",
    "vital_spo2",
    "systolic_bp",
    "ai_confidence",
]


@dataclass
class RiskResult:
    qsofa_score: int
    qsofa_flags: List[str]
    model_probability: Optional[float]
    risk_band: str  # low | moderate | high
    rationale: List[str]
    shap_contributions: Dict[str, float] = field(default_factory=dict)


def _parse_systolic(bp: Optional[str]) -> Optional[float]:
    if not bp:
        return None
    try:
        return float(str(bp).split("/")[0].strip())
    except (ValueError, IndexError):
        return None


def qsofa_score(vitals: Dict) -> tuple:
    """Sepsis-3 qSOFA. Returns (score 0-3, list of triggered criteria)."""
    score = 0
    flags: List[str] = []
    resp = vitals.get("vital_resp")
    if resp is not None and resp >= 22:
        score += 1
        flags.append(f"respiratory rate {resp} >= 22/min")
    systolic = _parse_systolic(vitals.get("vital_bp"))
    if systolic is not None and systolic <= 100:
        score += 1
        flags.append(f"systolic BP {systolic:.0f} <= 100 mmHg")
    if vitals.get("altered_mentation"):
        score += 1
        flags.append("altered mentation")
    return score, flags


class RiskModel:
    def __init__(self) -> None:
        self._model = None

    def _feature_vector(self, vitals: Dict, ai_confidence: float) -> np.ndarray:
        systolic = _parse_systolic(vitals.get("vital_bp"))
        row = [
            float(vitals.get("age") or 45),
            float(vitals.get("vital_temp") or 98.6),
            float(vitals.get("vital_hr") or 80),
            float(vitals.get("vital_resp") or 16),
            float(vitals.get("vital_spo2") or 98),
            float(systolic if systolic is not None else 120),
            float(ai_confidence or 0.0),
        ]
        return np.array([row], dtype=float)

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        import xgboost as xgb

        model = xgb.XGBClassifier(
            n_estimators=60, max_depth=3, learning_rate=0.15, eval_metric="logloss"
        )
        if os.path.exists(MODEL_PATH):
            model.load_model(MODEL_PATH)
        else:
            X, y = _synthetic_training_set()
            model.fit(X, y)
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            model.save_model(MODEL_PATH)
        self._model = model
        return model

    def predict(self, vitals: Dict, ai_confidence: float = 0.0) -> tuple:
        """Return (probability, {feature: shap_value})."""
        model = self._ensure_model()
        x = self._feature_vector(vitals, ai_confidence)
        prob = float(model.predict_proba(x)[0, 1])
        contributions: Dict[str, float] = {}
        try:
            import shap

            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(x)
            vals = shap_values[0] if isinstance(shap_values, list) else shap_values[0]
            contributions = {FEATURES[i]: round(float(vals[i]), 3) for i in range(len(FEATURES))}
        except Exception:
            pass
        return prob, contributions


_MODEL: Optional[RiskModel] = None


def get_risk_model() -> RiskModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = RiskModel()
    return _MODEL


def assess_risk(vitals: Dict, ai_confidence: float = 0.0) -> RiskResult:
    """Combine the qSOFA rule engine with the model; pick the more
    conservative band so the model can never downgrade a rule-based
    high-risk flag."""
    score, flags = qsofa_score(vitals)
    rationale: List[str] = []
    if flags:
        rationale.extend(flags)

    model_prob: Optional[float] = None
    contributions: Dict[str, float] = {}
    if os.getenv("HSIL_DISABLE_RISK_MODEL", "0") != "1":
        try:
            model_prob, contributions = get_risk_model().predict(vitals, ai_confidence)
        except Exception:
            model_prob = None

    rule_band = "high" if score >= 2 else "moderate" if score == 1 else "low"
    model_band = "low"
    if model_prob is not None:
        model_band = "high" if model_prob >= 0.66 else "moderate" if model_prob >= 0.33 else "low"
        top = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)[:3]
        if top:
            drivers = ", ".join(f"{k} ({'+' if v >= 0 else ''}{v})" for k, v in top)
            rationale.append(f"model probability {model_prob:.0%}; top drivers: {drivers}")

    order = {"low": 0, "moderate": 1, "high": 2}
    final_band = rule_band if order[rule_band] >= order[model_band] else model_band
    if not rationale:
        rationale.append("no qSOFA criteria met and model risk is low")

    return RiskResult(
        qsofa_score=score,
        qsofa_flags=flags,
        model_probability=model_prob,
        risk_band=final_band,
        rationale=rationale,
        shap_contributions=contributions,
    )


def _synthetic_training_set(n: int = 4000, seed: int = 7):
    """Clinically-shaped synthetic cohort for cold-start. Deterioration
    rises with hypoxia, tachypnea, hypotension, fever, and AI confidence.
    Replaced by real confirmed outcomes via the nightly fine-tune job."""
    rng = np.random.default_rng(seed)
    age = rng.normal(45, 18, n).clip(1, 95)
    temp = rng.normal(98.6, 1.8, n).clip(94, 107)
    hr = rng.normal(82, 18, n).clip(40, 180)
    resp = rng.normal(17, 5, n).clip(8, 45)
    spo2 = rng.normal(97, 3.5, n).clip(70, 100)
    systolic = rng.normal(122, 20, n).clip(70, 200)
    conf = rng.uniform(0, 1, n)

    logit = (
        -4.0
        + 0.05 * (resp - 18)
        + 0.06 * (94 - spo2)
        + 0.03 * (100 - systolic).clip(0, None)
        + 0.04 * (temp - 99).clip(0, None)
        + 0.02 * (hr - 90).clip(0, None)
        + 1.6 * conf
        + 0.015 * (age - 50).clip(0, None)
    )
    prob = 1 / (1 + np.exp(-logit))
    y = (rng.uniform(0, 1, n) < prob).astype(int)
    X = np.column_stack([age, temp, hr, resp, spo2, systolic, conf])
    return X, y
