import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Point at a throwaway DB before importing app modules.
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["SYNTRA_DB_PATH"] = _tmp_db.name
os.environ["SYNTRA_MODEL_PROVIDER"] = "fixture"

from fastapi.testclient import TestClient
from backend.main import app
from backend.database.db import init_db

init_db()
client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["ai_mode"] == "fixture"


def test_create_signal_persists_and_processes():
    payload = {
        "source": "Resident Report",
        "location": "Block B",
        "description": "Burning smell and flickering lights near the electrical room.",
    }
    r = client.post("/api/signals", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["id"].startswith("SIG-")
    assert body["status"] == "processed"

    r2 = client.get("/api/signals")
    assert any(s["id"] == body["id"] for s in r2.json())


def test_signal_requires_description():
    r = client.post("/api/signals", json={"source": "Resident Report"})
    assert r.status_code == 422


def test_list_incidents_empty_initially():
    r = client.get("/api/incidents")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_incident_404():
    r = client.get("/api/incidents/INC-doesnotexist")
    assert r.status_code == 404


def test_list_agents():
    r = client.get("/api/agents")
    assert r.status_code == 200
    names = [a["name"] for a in r.json()]
    assert names == ["Intake", "Correlation", "Risk", "Response", "Supervisor"]
    assert all(a["mode"] == "fixture" for a in r.json())


def test_agent_events_recorded_on_signal_creation():
    r = client.post("/api/signals", json={
        "source": "Sensor", "location": "Block A", "description": "Temperature spike detected."
    })
    assert r.status_code == 201
    events = client.get("/api/agent-events").json()
    assert any(e["agent"] == "Intake" for e in events)
