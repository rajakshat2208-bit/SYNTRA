"""Demo scenarios: synthetic-but-real signals pushed through the EXISTING
Intake -> Correlation -> Risk -> Response -> Supervisor pipeline.

No new data model, no fabricated incidents/events — every record created
here is a real row in the same tables the live /api/signals endpoint uses.
The only thing that marks a signal as demo data is metadata.demo_scenario,
which the frontend uses to render a "DEMO SCENARIO / SYNTHETIC INPUT" badge.
"""
from backend.services import repository as repo
from backend.services.orchestrator import process_new_signal

ELECTRICAL_FIRE_LOCATION = "Building A — Electrical Room 3"

ELECTRICAL_FIRE_SIGNALS = [
    {
        "source": "Resident Report",
        "description": (
            "Resident reports smoke and a burning smell coming from the "
            "electrical room on the 3rd floor."
        ),
    },
    {
        "source": "IoT Sensor",
        "description": (
            "Temperature anomaly detected: sustained spike to 68°C inside "
            "the electrical panel enclosure."
        ),
    },
    {
        "source": "Power Monitoring System",
        "description": (
            "Voltage fluctuation and power flicker detected on electrical "
            "panel EP-3."
        ),
    },
    {
        "source": "Building Management System",
        "description": (
            "System alert: smoke detector triggered in Electrical Room 3, "
            "fire suppression system armed."
        ),
    },
]


def _find_active_demo_incident():
    loc = ELECTRICAL_FIRE_LOCATION.strip().lower()
    for incident in repo.list_open_incidents():
        if (incident.get("location") or "").strip().lower() == loc:
            return incident
    return None


def run_electrical_fire_demo() -> dict:
    """Idempotent: if an active electrical-fire demo incident already exists,
    returns it unchanged instead of creating duplicate signals/incidents.
    """
    existing = _find_active_demo_incident()
    if existing:
        return {
            "status": "already_active",
            "scenario": "electrical_fire",
            "incident_id": existing["id"],
            "incident": existing,
        }

    created_signal_ids = []
    for item in ELECTRICAL_FIRE_SIGNALS:
        signal = repo.create_signal({
            "source": item["source"],
            "description": item["description"],
            "location": ELECTRICAL_FIRE_LOCATION,
            "metadata": {"demo_scenario": "electrical_fire"},
        })
        created_signal_ids.append(signal["id"])
        # Runs the real pipeline synchronously, same as POST /api/signals.
        process_new_signal(signal["id"])

    incident = _find_active_demo_incident()

    return {
        "status": "created",
        "scenario": "electrical_fire",
        "signal_ids": created_signal_ids,
        "incident_id": incident["id"] if incident else None,
        "incident": incident,
    }
