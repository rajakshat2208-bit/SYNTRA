from fastapi import APIRouter, HTTPException
from backend.models.schema import SignalCreate, ApprovalRequest
from backend.services import repository as repo
from backend.services.orchestrator import process_new_signal
from backend.agents.supervisor_agent import get_agent_status
from backend.agents.model_provider import is_ai_enabled

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {
        "status": "ok",
        "ai_mode": "anthropic" if is_ai_enabled() else "fixture",
    }


@router.post("/signals", status_code=201)
def create_signal(payload: SignalCreate):
    signal = repo.create_signal(payload.model_dump())
    try:
        process_new_signal(signal["id"])  # runs full Intake->Correlation->Risk->Response pipeline
    except Exception as e:
        # Safety net for unexpected orchestrator bugs — the per-stage handlers
        # inside process_new_signal already cover expected AI/validation failures.
        # This ensures a surprise error never surfaces as an unhandled 500 or
        # leaves the signal stuck without an explanation.
        repo.update_signal_status(signal["id"], "pipeline_error")
        repo.create_agent_event(
            agent="Supervisor", event_type="workflow_failed", status="error",
            signal_id=signal["id"], error=str(e),
        )
    return repo.get_signal(signal["id"])


@router.get("/signals")
def list_signals():
    return repo.list_signals()


@router.get("/signals/{signal_id}")
def get_signal(signal_id: str):
    signal = repo.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


@router.get("/incidents")
def list_incidents(status: str | None = None):
    return repo.list_incidents(status)


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    incident = repo.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.get("/incidents/{incident_id}/timeline")
def get_timeline(incident_id: str):
    if not repo.get_incident(incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return repo.get_timeline(incident_id)


@router.post("/incidents/{incident_id}/approve")
def approve_incident(incident_id: str, payload: ApprovalRequest):
    incident = repo.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident["status"] != "pending_approval":
        raise HTTPException(
            status_code=409,
            detail=f"Incident is '{incident['status']}', not awaiting approval",
        )
    repo.create_approval(incident_id, payload.approved_by, "approved")
    repo.update_incident(incident_id, status="approved")
    repo.add_timeline_event(incident_id, "Response approved", actor=payload.approved_by)
    repo.create_agent_event(
        agent="Supervisor", event_type="approval_recorded", status="completed",
        incident_id=incident_id, output_summary=f"Approved by {payload.approved_by}",
    )
    return repo.get_incident(incident_id)


@router.post("/incidents/{incident_id}/reject")
def reject_incident(incident_id: str, payload: ApprovalRequest):
    incident = repo.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident["status"] != "pending_approval":
        raise HTTPException(
            status_code=409,
            detail=f"Incident is '{incident['status']}', not awaiting approval",
        )
    repo.create_approval(incident_id, payload.approved_by, "rejected")
    repo.update_incident(incident_id, status="rejected")
    repo.add_timeline_event(incident_id, "Response rejected", actor=payload.approved_by)
    repo.create_agent_event(
        agent="Supervisor", event_type="approval_recorded", status="completed",
        incident_id=incident_id, output_summary=f"Rejected by {payload.approved_by}",
    )
    return repo.get_incident(incident_id)


@router.get("/agents")
def list_agents():
    return get_agent_status()


@router.get("/agent-events")
def list_agent_events(incident_id: str | None = None):
    return repo.list_agent_events(incident_id=incident_id)
