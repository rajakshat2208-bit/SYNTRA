"""Real Strands + Anthropic execution validation. Not run in normal CI —
requires a live ANTHROPIC_API_KEY and makes an actual paid API call.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

REAL_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

pytestmark = pytest.mark.skipif(
    not REAL_KEY,
    reason="ANTHROPIC_API_KEY not set — real AI test skipped, not faked.",
)


def test_real_intake_agent_call():
    os.environ["SYNTRA_MODEL_PROVIDER"] = "anthropic"

    from backend.agents.model_provider import is_ai_enabled
    from backend.agents.intake_agent import run_intake
    from backend.agents.schemas import IntakeResult
    from backend.services import repository as repo

    assert is_ai_enabled() is True

    signal = {
        "source": "Resident Report",
        "location": "Block B — Electrical Room",
        "description": "Burning smell and flickering lights reported near the electrical room.",
    }

    out = run_intake(signal)

    assert out["mode"] == "ai"
    result = IntakeResult(**out["result"])  # validates structured output
    assert result.normalized_type
    assert result.normalized_location

    # Confirm it serializes and the agent-event mechanism can record it as mode="ai".
    import json
    json.dumps(out["result"])
    event = repo.create_agent_event(
        agent="Intake", event_type="signal_normalized", status="completed",
        output_summary=f"[ai] {result.normalized_type} @ {result.normalized_location}",
    )
    assert event["output_summary"].startswith("[ai]")
