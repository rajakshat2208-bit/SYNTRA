"""Correlation Agent: determines whether signals represent one incident."""
from strands import Agent
from backend.agents.model_provider import get_model, is_ai_enabled
from backend.agents.schemas import CorrelationResult

SYSTEM_PROMPT = (
    "You are the Correlation Agent for SYNTRA. You receive a new signal, a list of "
    "recent stored signals, and any open incidents. Determine which prior signals are "
    "related by location/time/context, whether the new signal belongs to an existing "
    "open incident, and whether a new incident should be created. Return structured "
    "results only — no free-form narrative."
)


def run_correlation(new_signal: dict, candidate_signals: list[dict],
                     open_incidents: list[dict] | None = None) -> dict:
    open_incidents = open_incidents or []

    if is_ai_enabled():
        agent = Agent(model=get_model(), system_prompt=SYSTEM_PROMPT)
        candidates_text = "\n".join(
            f"- id={s['id']} source={s['source']} location={s.get('location')} desc={s['description']}"
            for s in candidate_signals
        ) or "(none)"
        incidents_text = "\n".join(
            f"- id={i['id']} title={i['title']} location={i.get('location')} status={i['status']}"
            for i in open_incidents
        ) or "(none)"
        prompt = (
            f"New signal: id={new_signal['id']} source={new_signal['source']} "
            f"location={new_signal.get('location')} desc={new_signal['description']}\n\n"
            f"Candidate prior signals:\n{candidates_text}\n\n"
            f"Open incidents:\n{incidents_text}"
        )
        try:
            result = agent(prompt, structured_output_model=CorrelationResult)
            return {"mode": "ai", "result": result.structured_output.model_dump()}
        except Exception as e:
            raise RuntimeError(f"Correlation agent AI call failed: {e}")

    # Fixture mode: correlate by matching location string (case-insensitive).
    loc = (new_signal.get("location") or "").strip().lower()
    related = [s["id"] for s in candidate_signals if loc and (s.get("location") or "").strip().lower() == loc]

    matching_incident = next(
        (i for i in open_incidents if loc and (i.get("location") or "").strip().lower() == loc),
        None,
    )

    result = CorrelationResult(
        related_signal_ids=related,
        related_incident_id=matching_incident["id"] if matching_incident else None,
        correlation_confidence=0.8 if related else 0.2,
        rationale=(
            f"{len(related)} prior signal(s) share location '{new_signal.get('location')}'."
            if related else "No prior signals share this location."
        ),
        should_create_incident=bool(related) and matching_incident is None,
    )
    return {"mode": "fixture", "result": result.model_dump()}
