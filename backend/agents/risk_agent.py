"""Risk Agent: assesses severity, confidence, and evidence for a correlated set of signals."""
from strands import Agent
from backend.agents.model_provider import get_model, is_ai_enabled
from backend.agents.schemas import RiskResult

SYSTEM_PROMPT = (
    "You are the Risk Agent for SYNTRA. You receive a group of correlated operational "
    "signals from a smart community/campus. Assess severity (low, medium, high, "
    "critical), a risk score (0.0-1.0), affected area, an affected population estimate "
    "(or 'unknown' if not determinable — never invent real-world facts), confidence, "
    "risk factors, and a recommended escalation level (none, local, facilities, "
    "emergency). Decide if human approval is required before any response action — "
    "assume it is required unless severity is clearly low. Never reveal internal "
    "reasoning steps — only the final structured assessment."
)


def run_risk(signals: list[dict], location: str | None = None) -> dict:
    if is_ai_enabled():
        agent = Agent(model=get_model(), system_prompt=SYSTEM_PROMPT)
        signals_text = "\n".join(
            f"- source={s['source']} location={s.get('location')} desc={s['description']}"
            for s in signals
        )
        prompt = f"Correlated signals:\n{signals_text}"
        try:
            result = agent(prompt, structured_output_model=RiskResult)
            return {"mode": "ai", "result": result.structured_output.model_dump()}
        except Exception as e:
            raise RuntimeError(f"Risk agent AI call failed: {e}")

    # Fixture mode: rule-based severity from keyword signals.
    text = " ".join(s["description"].lower() for s in signals)
    risk_factors = [f"{s['source']}: {s['description']}" for s in signals]

    critical_terms = ["fire", "smoke", "burning", "spark", "explosion"]
    high_terms = ["flicker", "power fluctuation", "temperature anomaly", "voltage"]

    if any(t in text for t in critical_terms) and len(signals) >= 2:
        severity, score = "critical", 0.9
    elif any(t in text for t in critical_terms) or (
        any(t in text for t in high_terms) and len(signals) >= 2
    ):
        severity, score = "high", 0.75
    elif len(signals) >= 2:
        severity, score = "medium", 0.6
    else:
        severity, score = "low", 0.4

    escalation = {"critical": "emergency", "high": "facilities", "medium": "local", "low": "none"}[severity]

    result = RiskResult(
        severity=severity,
        risk_score=score,
        affected_area=location or (signals[0].get("location") if signals else None) or "unspecified",
        affected_population_estimate="unknown",
        confidence=score,
        risk_factors=risk_factors,
        recommended_escalation_level=escalation,
        approval_required=severity in ("medium", "high", "critical"),
    )
    return {"mode": "fixture", "result": result.model_dump()}
