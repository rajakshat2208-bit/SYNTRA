"""Response Agent: generates a recommended response plan. Never executes actions itself."""
from strands import Agent
from backend.agents.model_provider import get_model, is_ai_enabled
from backend.agents.schemas import ResponseResult

SYSTEM_PROMPT = (
    "You are the Response Agent for SYNTRA. Given a risk assessment for a smart "
    "community/campus incident, propose a prioritized list of recommended response "
    "actions (e.g. dispatch maintenance, notify facilities, evacuate area), each with "
    "a responsible role/team. You never execute actions — you only recommend them. "
    "Mark any high-impact action as requiring human approval."
)


def run_response(severity: str, assessment: str) -> dict:
    if is_ai_enabled():
        agent = Agent(model=get_model(), system_prompt=SYSTEM_PROMPT)
        prompt = f"Severity: {severity}\nAssessment: {assessment}"
        try:
            result = agent(prompt, structured_output_model=ResponseResult)
            return {"mode": "ai", "result": result.structured_output.model_dump()}
        except Exception as e:
            raise RuntimeError(f"Response agent AI call failed: {e}")

    # Fixture mode: rule-based action templates by severity.
    if severity == "critical":
        actions = [
            {"action": "Dispatch facilities/electrical team immediately", "priority": "high",
             "responsible_role": "Facilities/Electrical", "requires_approval": True},
            {"action": "Cordon off Block B electrical room", "priority": "high",
             "responsible_role": "Campus Safety", "requires_approval": True},
            {"action": "Notify campus safety officer", "priority": "medium",
             "responsible_role": "Campus Safety", "requires_approval": False},
        ]
        comms = "Notify affected building occupants immediately."
    elif severity == "high":
        actions = [
            {"action": "Dispatch maintenance to inspect location", "priority": "high",
             "responsible_role": "Maintenance", "requires_approval": True},
            {"action": "Notify facilities team", "priority": "medium",
             "responsible_role": "Facilities", "requires_approval": False},
        ]
        comms = "Notify facilities team lead."
    elif severity == "medium":
        actions = [
            {"action": "Schedule maintenance inspection", "priority": "medium",
             "responsible_role": "Maintenance", "requires_approval": False},
        ]
        comms = "No immediate broad communication required."
    else:
        actions = [
            {"action": "Log for routine review", "priority": "low",
             "responsible_role": "Operations", "requires_approval": False},
        ]
        comms = "No communication required."

    result = ResponseResult(
        recommended_actions=actions,
        communication_recommendation=comms,
        reason=f"Response scaled to {severity} severity assessment.",
        requires_human_approval=severity in ("medium", "high", "critical"),
    )
    return {"mode": "fixture", "result": result.model_dump()}
