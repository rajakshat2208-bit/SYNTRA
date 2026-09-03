"""Supervisor Agent: coordinates the workflow and enforces the human-approval gate.

Phase 1 scope: agent registry + approval-safety validation only.
Full pipeline orchestration (intake -> correlation -> risk -> response -> supervisor)
is wired in Phase 2 against the signal-creation endpoint.
"""
from backend.agents.model_provider import is_ai_enabled

AGENT_REGISTRY = [
    {"name": "Intake", "role": "Normalizes newly submitted signals"},
    {"name": "Correlation", "role": "Links related signals into candidate incidents"},
    {"name": "Risk", "role": "Assesses severity, confidence, and evidence"},
    {"name": "Response", "role": "Generates a recommended, human-approved response plan"},
    {"name": "Supervisor", "role": "Coordinates the workflow and enforces human approval"},
]


def get_agent_status() -> list[dict]:
    mode = "ai" if is_ai_enabled() else "fixture"
    return [{**a, "mode": mode, "status": "idle"} for a in AGENT_REGISTRY]


def requires_human_approval(severity: str) -> bool:
    """Critical actions always require human approval regardless of agent output."""
    return severity in ("medium", "high", "critical")
