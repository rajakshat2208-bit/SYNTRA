import os
import sys
import sqlite3
import tempfile
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["SYNTRA_DB_PATH"] = _tmp_db.name
os.environ["SYNTRA_MODEL_PROVIDER"] = "fixture"

from fastapi.testclient import TestClient
from backend.main import app
from backend.database.db import init_db, DB_PATH
from backend.services import repository as repo

init_db()
client = TestClient(app)


def _create_signal(location, description, source="Sensor"):
    r = client.post("/api/signals", json={
        "source": source, "location": location, "description": description,
    })
    assert r.status_code == 201
    return r.json()


def test_full_pipeline_reaches_pending_approval():
    _create_signal("Test Block", "Unusual noise reported near the panel.", source="Resident Report")
    second = _create_signal("Test Block", "Power fluctuation detected in panel.", source="Sensor")

    assert second["incident_id"] is not None
    incident = client.get(f"/api/incidents/{second['incident_id']}").json()

    assert incident["status"] == "pending_approval"
    assert incident["severity"] in ("medium", "high", "critical")
    assert len(incident["recommended_actions"]) > 0
    assert incident["approval_required"] is True

    timeline = client.get(f"/api/incidents/{incident['id']}/timeline").json()
    events = [t["event"] for t in timeline]
    assert any("correlated" in e.lower() or "created" in e.lower() for e in events)
    assert any("risk assessed" in e.lower() for e in events)
    assert any("response proposed" in e.lower() for e in events)

    # Correlation runs before the incident exists, so its event is keyed by signal_id,
    # not incident_id — check the full event log instead of the incident-scoped one.
    all_events = client.get("/api/agent-events").json()
    agents_seen = {e["agent"] for e in all_events}
    assert {"Correlation", "Risk", "Response", "Supervisor"}.issubset(agents_seen)

    incident_events = client.get(f"/api/agent-events?incident_id={incident['id']}").json()
    assert {"Risk", "Response", "Supervisor"}.issubset({e["agent"] for e in incident_events})
    assert all(e["mode"] == "fixture" for e in incident_events)


def test_single_signal_does_not_create_incident():
    signal = _create_signal("Solo Wing", "Routine reading, nothing unusual.")
    assert signal["incident_id"] is None
    assert signal["status"] == "processed"


def test_approve_incident():
    _create_signal("Approve Wing", "Burning smell reported.", source="Resident Report")
    second = _create_signal("Approve Wing", "Temperature anomaly detected.", source="Sensor")
    incident_id = second["incident_id"]
    assert client.get(f"/api/incidents/{incident_id}").json()["status"] == "pending_approval"

    r = client.post(f"/api/incidents/{incident_id}/approve", json={"approved_by": "ops-lead"})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    timeline = client.get(f"/api/incidents/{incident_id}/timeline").json()
    assert any("approved" in t["event"].lower() for t in timeline)

    # Approving again must fail cleanly, not silently succeed.
    r2 = client.post(f"/api/incidents/{incident_id}/approve", json={"approved_by": "ops-lead"})
    assert r2.status_code == 409


def test_reject_incident():
    _create_signal("Reject Wing", "Spark reported near panel.", source="Resident Report")
    second = _create_signal("Reject Wing", "Voltage spike detected.", source="Sensor")
    incident_id = second["incident_id"]

    r = client.post(f"/api/incidents/{incident_id}/reject", json={"approved_by": "ops-lead"})
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"

    timeline = client.get(f"/api/incidents/{incident_id}/timeline").json()
    assert any("rejected" in t["event"].lower() for t in timeline)


def test_approve_nonexistent_incident_404():
    r = client.post("/api/incidents/INC-doesnotexist/approve", json={"approved_by": "x"})
    assert r.status_code == 404


def test_intake_failure_does_not_corrupt_db():
    with patch("backend.services.orchestrator.run_intake", side_effect=RuntimeError("AI ASSESSMENT UNAVAILABLE: boom")):
        signal = _create_signal("Failure Wing", "Some report.")

    stored = client.get(f"/api/signals/{signal['id']}").json()
    assert stored["status"] == "intake_failed"

    events = client.get(f"/api/agent-events").json()
    matching = [e for e in events if e["signal_id"] == signal["id"] and e["agent"] == "Intake"]
    assert matching[0]["status"] == "error"
    assert "boom" in matching[0]["error"]

    # DB must remain queryable and other data untouched.
    assert client.get("/api/incidents").status_code == 200


def test_persistence_after_simulated_restart():
    signal = _create_signal("Persist Wing", "Reading logged.")
    # Bypass the app layer entirely — open a fresh raw connection to the same file,
    # simulating a backend restart reading from disk.
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT id, status FROM signals WHERE id = ?", (signal["id"],)).fetchone()
    conn.close()
    assert row is not None
    assert row[0] == signal["id"]


def test_correlation_event_linked_to_incident_without_duplication():
    _create_signal("Link Wing", "Spark reported near panel.", source="Resident Report")
    second = _create_signal("Link Wing", "Voltage spike detected.", source="Sensor")
    incident_id = second["incident_id"]
    assert incident_id is not None

    all_events = client.get("/api/agent-events").json()
    correlation_events = [e for e in all_events if e["agent"] == "Correlation" and e["signal_id"] == second["id"]]

    # Exactly one correlation event for this signal — linked, not duplicated.
    assert len(correlation_events) == 1
    assert correlation_events[0]["incident_id"] == incident_id
    # Original content preserved — not rewritten into a generic placeholder.
    assert correlation_events[0]["structured_output"] is not None
    assert correlation_events[0]["mode"] == "fixture"


def test_approve_rejected_incident_fails():
    _create_signal("Flip Wing A", "Burning smell reported.", source="Resident Report")
    second = _create_signal("Flip Wing A", "Temperature anomaly detected.", source="Sensor")
    incident_id = second["incident_id"]

    r = client.post(f"/api/incidents/{incident_id}/reject", json={"approved_by": "ops-lead"})
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"

    r2 = client.post(f"/api/incidents/{incident_id}/approve", json={"approved_by": "ops-lead"})
    assert r2.status_code == 409


def test_reject_approved_incident_fails():
    _create_signal("Flip Wing B", "Burning smell reported.", source="Resident Report")
    second = _create_signal("Flip Wing B", "Temperature anomaly detected.", source="Sensor")
    incident_id = second["incident_id"]

    r = client.post(f"/api/incidents/{incident_id}/approve", json={"approved_by": "ops-lead"})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    r2 = client.post(f"/api/incidents/{incident_id}/reject", json={"approved_by": "ops-lead"})
    assert r2.status_code == 409
