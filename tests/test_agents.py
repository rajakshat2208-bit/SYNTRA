import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("SYNTRA_MODEL_PROVIDER", "fixture")

from backend.agents.intake_agent import run_intake
from backend.agents.correlation_agent import run_correlation
from backend.agents.risk_agent import run_risk
from backend.agents.response_agent import run_response
from backend.agents.supervisor_agent import requires_human_approval


def test_intake_fixture_classifies_electrical():
    out = run_intake({"source": "Resident Report", "location": "Block B",
                       "description": "Flickering lights and burning smell."})
    assert out["mode"] == "fixture"
    assert out["result"]["normalized_type"] == "electrical_signal"


def test_correlation_fixture_matches_location():
    new = {"id": "SIG-1", "source": "Sensor", "location": "Block B", "description": "Power fluctuation"}
    candidates = [
        {"id": "SIG-0", "source": "Resident Report", "location": "Block B", "description": "Burning smell"},
        {"id": "SIG-x", "source": "Sensor", "location": "Block C", "description": "Unrelated"},
    ]
    out = run_correlation(new, candidates)
    assert out["result"]["related_signal_ids"] == ["SIG-0"]
    assert out["result"]["should_create_incident"] is True


def test_risk_fixture_flags_critical_with_multiple_signals():
    signals = [
        {"source": "Resident Report", "description": "Burning smell near electrical room"},
        {"source": "Sensor", "description": "Temperature anomaly detected"},
    ]
    out = run_risk(signals)
    assert out["result"]["severity"] == "critical"
    assert out["result"]["approval_required"] is True


def test_response_fixture_generates_actions_for_critical():
    out = run_response("critical", "Probable electrical fault")
    actions = out["result"]["recommended_actions"]
    assert len(actions) > 0
    assert any(a["requires_approval"] for a in actions)


def test_approval_gate_blocks_low_only():
    assert requires_human_approval("critical") is True
    assert requires_human_approval("high") is True
    assert requires_human_approval("low") is False
