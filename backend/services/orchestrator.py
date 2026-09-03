"""Orchestrates Intake -> Correlation -> Risk -> Response for a new signal.

This is the Supervisor's execution logic: validates each agent's structured
output with Pydantic before trusting it, records an auditable agent_event for
every step (success or failure), never corrupts the database on a failed
step, and never bypasses human approval when the Risk/Response agents say
it's required.
"""
from pydantic import ValidationError

from backend.services import repository as repo
from backend.agents.intake_agent import run_intake
from backend.agents.correlation_agent import run_correlation
from backend.agents.risk_agent import run_risk
from backend.agents.response_agent import run_response
from backend.agents.schemas import IntakeResult, CorrelationResult, RiskResult, ResponseResult


def _log(agent: str, event_type: str, status: str, mode: str = "fixture", **kwargs):
    return repo.create_agent_event(agent=agent, event_type=event_type, status=status, mode=mode, **kwargs)


def process_new_signal(signal_id: str) -> dict:
    """Runs the full pipeline for one signal. Returns a summary dict describing
    what happened at each stage — never raises; failures are recorded and returned.
    """
    signal = repo.get_signal(signal_id)
    if not signal:
        raise ValueError(f"Signal {signal_id} not found")

    repo.update_signal_status(signal_id, "processing")
    outcome = {"signal_id": signal_id, "stages": {}}

    # ---- Intake ----
    try:
        intake_out = run_intake(signal)
        intake_result = IntakeResult(**intake_out["result"])  # validate before trusting
        _log("Intake", "signal_normalized", "completed", mode=intake_out["mode"],
             signal_id=signal_id, structured_output=intake_result.model_dump(),
             output_summary=f"{intake_result.normalized_type} @ {intake_result.normalized_location}")
        outcome["stages"]["intake"] = intake_result.model_dump()
    except (RuntimeError, ValidationError) as e:
        repo.update_signal_status(signal_id, "intake_failed")
        _log("Intake", "signal_normalized", "error", signal_id=signal_id, error=str(e))
        outcome["stages"]["intake"] = {"error": str(e)}
        return outcome

    # ---- Correlation ----
    candidates = repo.list_recent_signals_excluding(signal_id, limit=20)
    open_incidents = repo.list_open_incidents()
    try:
        corr_out = run_correlation(signal, candidates, open_incidents)
        corr_result = CorrelationResult(**corr_out["result"])
        correlation_event = _log(
            "Correlation", "signals_correlated", "completed", mode=corr_out["mode"],
            signal_id=signal_id, structured_output=corr_result.model_dump(),
            output_summary=corr_result.rationale,
        )
        outcome["stages"]["correlation"] = corr_result.model_dump()
    except (RuntimeError, ValidationError) as e:
        repo.update_signal_status(signal_id, "correlation_failed")
        _log("Correlation", "signals_correlated", "error", signal_id=signal_id, error=str(e))
        outcome["stages"]["correlation"] = {"error": str(e)}
        return outcome

    incident = None
    if corr_result.related_incident_id:
        incident = repo.get_incident(corr_result.related_incident_id)
        if incident:
            updated_ids = list(set(incident["signal_ids"] + [signal_id]))
            repo.update_incident(incident["id"], signal_ids=updated_ids)
            repo.add_timeline_event(incident["id"], "Signal correlated to existing incident",
                                     actor="Correlation Agent", details=signal_id)
    elif corr_result.should_create_incident:
        member_ids = list(set(corr_result.related_signal_ids + [signal_id]))
        incident = repo.create_incident(
            title=f"Correlated incident — {signal.get('location') or 'unspecified location'}",
            location=signal.get("location"),
            signal_ids=member_ids,
        )
        repo.add_timeline_event(incident["id"], "Incident created from correlated signals",
                                 actor="Correlation Agent")

    if not incident:
        repo.update_signal_status(signal_id, "processed")
        outcome["stages"]["incident"] = None
        return outcome

    # Link the correlation event to the incident it produced — preserves the
    # original event (timestamp, structured output, status) rather than
    # duplicating or rewriting it.
    repo.link_agent_event_to_incident(correlation_event["id"], incident["id"])

    repo.update_signal_status(signal_id, "processed", incident_id=incident["id"])
    repo.update_incident(incident["id"], status="correlated")
    outcome["incident_id"] = incident["id"]

    # ---- Risk ----
    member_signals = [repo.get_signal(sid) for sid in incident["signal_ids"]]
    member_signals = [s for s in member_signals if s]
    try:
        risk_out = run_risk(member_signals, location=incident.get("location"))
        risk_result = RiskResult(**risk_out["result"])
        _log("Risk", "risk_assessed", "completed", mode=risk_out["mode"],
             incident_id=incident["id"], structured_output=risk_result.model_dump(),
             output_summary=f"severity={risk_result.severity} confidence={risk_result.confidence}")
        outcome["stages"]["risk"] = risk_result.model_dump()
    except (RuntimeError, ValidationError) as e:
        repo.update_incident(incident["id"], status="risk_failed")
        _log("Risk", "risk_assessed", "error", incident_id=incident["id"], error=str(e))
        outcome["stages"]["risk"] = {"error": str(e)}
        return outcome

    assessment_text = (
        f"{risk_result.severity.capitalize()} severity ({risk_result.confidence:.0%} confidence). "
        f"Affected area: {risk_result.affected_area}. "
        f"Recommended escalation: {risk_result.recommended_escalation_level}."
    )
    repo.update_incident(
        incident["id"], severity=risk_result.severity, confidence=risk_result.risk_score,
        evidence=risk_result.risk_factors, assessment=assessment_text,
        approval_required=1 if risk_result.approval_required else 0, status="risk_assessed",
    )
    repo.add_timeline_event(incident["id"], f"Risk assessed as {risk_result.severity}",
                             actor="Risk Agent")

    # ---- Response ----
    try:
        resp_out = run_response(risk_result.severity, assessment_text)
        resp_result = ResponseResult(**resp_out["result"])
        _log("Response", "response_proposed", "completed", mode=resp_out["mode"],
             incident_id=incident["id"], structured_output=resp_result.model_dump(),
             output_summary=f"{len(resp_result.recommended_actions)} action(s) proposed")
        outcome["stages"]["response"] = resp_result.model_dump()
    except (RuntimeError, ValidationError) as e:
        repo.update_incident(incident["id"], status="response_failed")
        _log("Response", "response_proposed", "error", incident_id=incident["id"], error=str(e))
        outcome["stages"]["response"] = {"error": str(e)}
        return outcome

    requires_approval = resp_result.requires_human_approval or risk_result.approval_required
    next_status = "pending_approval" if requires_approval else "resolved"
    repo.update_incident(
        incident["id"],
        recommended_actions=[a.model_dump() for a in resp_result.recommended_actions],
        approval_required=1 if requires_approval else 0,
        status=next_status,
    )
    repo.add_timeline_event(
        incident["id"],
        "Response proposed — awaiting human approval" if requires_approval else "Response proposed — auto-resolved, no approval required",
        actor="Response Agent",
    )
    _log("Supervisor", "workflow_completed", "completed", mode=resp_out["mode"],
         incident_id=incident["id"], output_summary=f"incident now {next_status}")

    outcome["final_status"] = next_status
    return outcome
