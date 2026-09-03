"""Intake Agent: normalizes a newly submitted signal."""
from strands import Agent
from backend.agents.model_provider import get_model, is_ai_enabled
from backend.agents.schemas import IntakeResult

SYSTEM_PROMPT = (
    "You are the Intake Agent for SYNTRA, an operational intelligence system for a "
    "smart community/campus. You receive a raw operational signal and normalize it: "
    "identify its type, location, urgency, and key extracted facts. Be concise. "
    "Never speculate beyond what the signal states."
)


def run_intake(signal: dict) -> dict:
    """Returns {'mode': 'ai'|'fixture', 'result': dict} or raises RuntimeError on AI failure."""
    if is_ai_enabled():
        agent = Agent(model=get_model(), system_prompt=SYSTEM_PROMPT)
        prompt = (
            f"Signal source: {signal['source']}\n"
            f"Location: {signal.get('location') or 'unknown'}\n"
            f"Description: {signal['description']}"
        )
        try:
            result = agent(prompt, structured_output_model=IntakeResult)
            return {"mode": "ai", "result": result.structured_output.model_dump()}
        except Exception as e:
            raise RuntimeError(f"Intake agent AI call failed: {e}")

    # Fixture mode: deterministic rule-based normalization, explicitly not AI.
    desc = signal["description"].lower()
    if "temperature" in desc or "°c" in desc or "heat" in desc:
        normalized_type = "sensor_reading"
    elif "power" in desc or "voltage" in desc or "electrical" in desc or "flicker" in desc:
        normalized_type = "electrical_signal"
    elif signal["source"].lower() == "resident report":
        normalized_type = "resident_report"
    else:
        normalized_type = signal.get("type") or "general_report"

    critical_terms = ["fire", "smoke", "burning", "spark", "explosion"]
    urgency = "high" if any(t in desc for t in critical_terms) else "medium"

    entities = [signal["source"]]
    if signal.get("location"):
        entities.append(signal["location"])

    result = IntakeResult(
        normalized_type=normalized_type,
        normalized_location=signal.get("location") or "unspecified",
        urgency=urgency,
        entities=entities,
        confidence=0.6,
        summary=f"{signal['source']} signal at {signal.get('location') or 'unspecified location'}.",
    )
    return {"mode": "fixture", "result": result.model_dump()}
