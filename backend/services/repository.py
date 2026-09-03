"""Repository: all SQLite reads/writes go through here."""
import json
import uuid
from datetime import datetime, timezone
from backend.database.db import db_cursor


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


# ---------- Signals ----------

def create_signal(data: dict) -> dict:
    sid = _new_id("SIG")
    ts = _now()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO signals (id, timestamp, source, type, location, description, "
            "severity, metadata, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, ts, data["source"], data.get("type"), data.get("location"),
             data["description"], data.get("severity"),
             json.dumps(data.get("metadata") or {}), "received"),
        )
    return get_signal(sid)


def get_signal(signal_id: str) -> dict | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM signals WHERE id = ?", (signal_id,))
        row = cur.fetchone()
    return _signal_row_to_dict(row) if row else None


def list_signals(limit: int = 100) -> list[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
    return [_signal_row_to_dict(r) for r in rows]


def list_recent_signals_excluding(exclude_id: str, limit: int = 20) -> list[dict]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM signals WHERE id != ? ORDER BY timestamp DESC LIMIT ?",
            (exclude_id, limit),
        )
        rows = cur.fetchall()
    return [_signal_row_to_dict(r) for r in rows]


def update_signal_status(signal_id: str, status: str, incident_id: str | None = None):
    with db_cursor() as cur:
        if incident_id is not None:
            cur.execute("UPDATE signals SET status = ?, incident_id = ? WHERE id = ?",
                        (status, incident_id, signal_id))
        else:
            cur.execute("UPDATE signals SET status = ? WHERE id = ?", (status, signal_id))


def _signal_row_to_dict(row) -> dict:
    d = dict(row)
    d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
    return d


# ---------- Incidents ----------

def create_incident(title: str, location: str, signal_ids: list[str]) -> dict:
    iid = _new_id("INC")
    ts = _now()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO incidents (id, title, location, severity, confidence, status, "
            "signal_ids, evidence, assessment, recommended_actions, approval_required, "
            "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (iid, title, location, None, None, "detected",
             json.dumps(signal_ids), json.dumps([]), None, json.dumps([]), 1, ts, ts),
        )
    return get_incident(iid)


def get_incident(incident_id: str) -> dict | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = cur.fetchone()
    return _incident_row_to_dict(row) if row else None


def list_incidents(status: str | None = None) -> list[dict]:
    with db_cursor() as cur:
        if status:
            cur.execute("SELECT * FROM incidents WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
        rows = cur.fetchall()
    return [_incident_row_to_dict(r) for r in rows]


CLOSED_STATUSES = ("resolved", "closed", "rejected")


def list_open_incidents() -> list[dict]:
    with db_cursor() as cur:
        placeholders = ",".join("?" * len(CLOSED_STATUSES))
        cur.execute(
            f"SELECT * FROM incidents WHERE status NOT IN ({placeholders}) ORDER BY created_at DESC",
            CLOSED_STATUSES,
        )
        rows = cur.fetchall()
    return [_incident_row_to_dict(r) for r in rows]


def update_incident(incident_id: str, **fields):
    if not fields:
        return
    for json_field in ("signal_ids", "evidence", "recommended_actions"):
        if json_field in fields and not isinstance(fields[json_field], str):
            fields[json_field] = json.dumps(fields[json_field])
    fields["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [incident_id]
    with db_cursor() as cur:
        cur.execute(f"UPDATE incidents SET {cols} WHERE id = ?", values)


def _incident_row_to_dict(row) -> dict:
    d = dict(row)
    d["signal_ids"] = json.loads(d["signal_ids"]) if d.get("signal_ids") else []
    d["evidence"] = json.loads(d["evidence"]) if d.get("evidence") else []
    d["recommended_actions"] = json.loads(d["recommended_actions"]) if d.get("recommended_actions") else []
    d["approval_required"] = bool(d["approval_required"])
    return d


# ---------- Agent events ----------

def create_agent_event(agent: str, event_type: str, status: str, mode: str = "fixture",
                        incident_id: str | None = None, signal_id: str | None = None,
                        output_summary: str | None = None, structured_output: dict | None = None,
                        error: str | None = None) -> dict:
    eid = _new_id("EVT")
    ts = _now()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO agent_events (id, timestamp, agent, event_type, incident_id, "
            "signal_id, mode, status, output_summary, structured_output, error) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (eid, ts, agent, event_type, incident_id, signal_id, mode, status, output_summary,
             json.dumps(structured_output) if structured_output is not None else None, error),
        )
    return _event_row_to_dict({
        "id": eid, "timestamp": ts, "agent": agent, "event_type": event_type,
        "incident_id": incident_id, "signal_id": signal_id, "mode": mode, "status": status,
        "output_summary": output_summary,
        "structured_output": json.dumps(structured_output) if structured_output is not None else None,
        "error": error,
    })


def list_agent_events(limit: int = 100, incident_id: str | None = None) -> list[dict]:
    with db_cursor() as cur:
        if incident_id:
            cur.execute(
                "SELECT * FROM agent_events WHERE incident_id = ? ORDER BY timestamp DESC LIMIT ?",
                (incident_id, limit),
            )
        else:
            cur.execute("SELECT * FROM agent_events ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
    return [_event_row_to_dict(dict(r)) for r in rows]


def link_agent_event_to_incident(event_id: str, incident_id: str):
    """Attach an incident_id to an already-recorded event (e.g. correlation ran
    before the incident existed). Updates linkage only — timestamp, agent,
    structured_output, and status are left untouched, so the original event is
    preserved rather than duplicated or rewritten.
    """
    with db_cursor() as cur:
        cur.execute("UPDATE agent_events SET incident_id = ? WHERE id = ?", (incident_id, event_id))


def _event_row_to_dict(d: dict) -> dict:
    d = dict(d)
    d["structured_output"] = json.loads(d["structured_output"]) if d.get("structured_output") else None
    return d


# ---------- Timeline ----------

def add_timeline_event(incident_id: str, event: str, actor: str | None = None,
                        details: str | None = None) -> dict:
    tid = _new_id("TL")
    ts = _now()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO incident_timeline (id, incident_id, timestamp, event, actor, details) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (tid, incident_id, ts, event, actor, details),
        )
    return {"id": tid, "incident_id": incident_id, "timestamp": ts, "event": event,
            "actor": actor, "details": details}


def get_timeline(incident_id: str) -> list[dict]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM incident_timeline WHERE incident_id = ? ORDER BY timestamp ASC",
            (incident_id,),
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


# ---------- Approvals ----------

def create_approval(incident_id: str, approved_by: str, status: str) -> dict:
    aid = _new_id("APR")
    ts = _now()
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO approvals (id, incident_id, approved_by, timestamp, status) "
            "VALUES (?, ?, ?, ?, ?)",
            (aid, incident_id, approved_by, ts, status),
        )
    return {"id": aid, "incident_id": incident_id, "approved_by": approved_by,
            "timestamp": ts, "status": status}
