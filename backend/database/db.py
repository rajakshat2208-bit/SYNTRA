"""SQLite persistence. Raw sqlite3 — no ORM needed at this scale."""
import sqlite3
from contextlib import contextmanager
from backend.config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    type TEXT,
    location TEXT,
    description TEXT NOT NULL,
    severity TEXT,
    metadata TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    incident_id TEXT
);

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT,
    severity TEXT,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'detected',
    signal_ids TEXT,
    evidence TEXT,
    assessment TEXT,
    recommended_actions TEXT,
    approval_required INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    agent TEXT NOT NULL,
    event_type TEXT NOT NULL,
    incident_id TEXT,
    signal_id TEXT,
    mode TEXT NOT NULL DEFAULT 'fixture',
    status TEXT NOT NULL,
    output_summary TEXT,
    structured_output TEXT,
    error TEXT
);

CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    severity TEXT,
    confidence REAL,
    evidence TEXT,
    assessment TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    approved_by TEXT,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_timeline (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    event TEXT NOT NULL,
    actor TEXT,
    details TEXT
);
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db_cursor() as cur:
        cur.executescript(SCHEMA)
