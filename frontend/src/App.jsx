import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveIncident,
  createSignal,
  getHealth,
  getIncident,
  getIncidentTimeline,
  listAgentEvents,
  listAgents,
  listIncidents,
  listSignals,
  rejectIncident,
} from "./services/api";

const NAV = [
  ["command", "Command Center", "dashboard"],
  ["incidents", "Incidents", "warning"],
  ["signals", "Signals", "sensors"],
  ["agents", "Agent Activity", "smart_toy"],
  ["analytics", "Analytics", "leaderboard"],
  ["history", "History", "history"],
];

const AGENT_ICONS = {
  Intake: "input",
  Correlation: "hub",
  Risk: "gpp_maybe",
  Response: "auto_fix_high",
  Supervisor: "verified_user",
};

const SEVERITY = {
  critical: { cls: "critical", icon: "local_fire_department" },
  high: { cls: "high", icon: "warning" },
  medium: { cls: "medium", icon: "priority_high" },
  low: { cls: "low", icon: "check_circle" },
};

function Icon({ name, fill = false }) {
  return (
    <span className={`material-symbols-outlined ${fill ? "icon-fill" : ""}`}>
      {name}
    </span>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function severityTone(severity) {
  return SEVERITY[severity]?.cls || "neutral";
}

function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function EmptyState({ icon = "inbox", title, children }) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

function LoadingState({ label = "Loading" }) {
  return (
    <div className="loading-state">
      <span className="spinner" /> {label}…
    </div>
  );
}

function SystemHeader({ health, onNavigate }) {
  const ok = health?.status === "ok";

  return (
    <header className="topbar">
      <button
        className="mobile-brand"
        onClick={() => onNavigate("command")}
        aria-label="Go to Command Center"
      >
        <span>SYNTRA</span>
      </button>

      <div className="top-search">
        <Icon name="search" />
        <input
          placeholder="Search current view…"
          aria-label="Search current view"
        />
      </div>

      <div className="top-status">
        <span className={`status-dot ${ok ? "online" : "offline"}`} />
        <span>{ok ? "SYSTEM OPERATIONAL" : "SYSTEM DEGRADED"}</span>
        <div className="divider" />
        <Badge
          tone={health?.ai_mode === "anthropic" ? "ai" : "fixture"}
        >
          {health?.ai_mode === "anthropic"
            ? "AI · LIVE"
            : "FIXTURE · DEVELOPMENT"}
        </Badge>
        <button className="icon-button" title="Notifications" type="button">
          <Icon name="notifications" />
        </button>
        <button className="icon-button" title="Operator" type="button">
          <Icon name="account_circle" />
        </button>
      </div>
    </header>
  );
}

function Sidebar({ active, onNavigate, onSupport, onSettings }) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() => onNavigate("command")}
        aria-label="Go to Command Center"
      >
        <span>SYNTRA</span>
      </button>

      <nav>
        {NAV.map(([id, label, icon]) => (
          <button
            key={id}
            className={active === id ? "nav-item active" : "nav-item"}
            onClick={() => onNavigate(id)}
            type="button"
          >
            <Icon name={icon} fill={active === id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" onClick={onSupport} type="button">
          <Icon name="help" />
          <span>Support</span>
        </button>
        <button className="nav-item" onClick={onSettings} type="button">
          <Icon name="settings" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ active, onNavigate }) {
  return (
    <nav className="mobile-nav">
      {NAV.slice(0, 5).map(([id, label, icon]) => (
        <button
          key={id}
          className={active === id ? "active" : ""}
          onClick={() => onNavigate(id)}
          type="button"
        >
          <Icon name={icon} fill={active === id} />
          <small>{label.split(" ")[0]}</small>
        </button>
      ))}
    </nav>
  );
}

function Metric({ label, value, tone = "neutral", hint }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  );
}

function AgentFlow({ events }) {
  const latest = {};

  events.forEach((e) => {
    if (!latest[e.agent]) latest[e.agent] = e;
  });

  return (
    <div className="agent-flow">
      {Object.keys(AGENT_ICONS).map((agent, index) => {
        const event = latest[agent];
        const status = event?.status || "idle";

        return (
          <div
            className={`flow-stage ${
              status === "completed"
                ? "complete"
                : status === "error"
                ? "error"
                : event
                ? "active"
                : ""
            }`}
            key={agent}
          >
            <div className="flow-node">
              <Icon
                name={AGENT_ICONS[agent]}
                fill={status === "completed"}
              />
              {event && <span className="node-dot" />}
            </div>
            <span>{agent.toUpperCase()}</span>
            {index < 4 && (
              <div className="flow-line">
                <i />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CorrelationGraph({ signals, selectedIncident }) {
  const linked =
    selectedIncident?.signal_ids
      ?.map((id) => signals.find((s) => s.id === id))
      .filter(Boolean) || [];

  const shown = linked.length
    ? linked.slice(0, 5)
    : signals.filter((s) => s.incident_id).slice(0, 5);

  return (
    <div className="correlation-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">LIVE CORRELATION</span>
          <h3>Signal Fusion</h3>
        </div>
        <Badge tone="ai">REAL RELATIONSHIPS</Badge>
      </div>

      <div className="graph-canvas">
        <div className="graph-grid" />

        {shown.length === 0 ? (
          <div className="graph-empty">
            <Icon name="hub" />
            <span>No correlated signals yet.</span>
            <small>Submit related signals to create an incident.</small>
          </div>
        ) : (
          <>
            {shown.map((s, i) => (
              <div key={s.id} className={`signal-node n${i}`}>
                <div>
                  <Icon
                    name={SEVERITY[s.severity]?.icon || "sensors"}
                  />
                </div>
                <span>{s.id}</span>
              </div>
            ))}

            {selectedIncident && (
              <div className="incident-node">
                <div className="incident-ring">
                  <Icon
                    name={
                      SEVERITY[selectedIncident.severity]?.icon ||
                      "warning"
                    }
                    fill
                  />
                </div>
                <span>{selectedIncident.id}</span>
                <small>{selectedIncident.title}</small>
              </div>
            )}

            {selectedIncident &&
              shown.map((s, i) => (
                <svg
                  key={`l-${s.id}`}
                  className={`link l${i}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <line
                    x1="50"
                    y1="50"
                    x2={20 + i * 15}
                    y2={15 + (i % 3) * 28}
                  />
                </svg>
              ))}
          </>
        )}
      </div>

      <div className="graph-footer">
        <span>
          <i className="legend-dot cyan" /> Signals
        </span>
        <span>
          <i className="legend-dot red" /> Incident
        </span>
        <span>{shown.length} linked</span>
      </div>
    </div>
  );
}

function AssessmentPanel({
  incident,
  signals,
  events,
  onApprove,
  onReject,
  busy,
}) {
  if (!incident) {
    return (
      <div className="assessment-panel">
        <EmptyState icon="psychology" title="No incident selected">
          Select an incident to inspect SYNTRA&apos;s assessment.
        </EmptyState>
      </div>
    );
  }

  const tone = severityTone(incident.severity);
  const linked = signals.filter((s) =>
    incident.signal_ids?.includes(s.id)
  );

  return (
    <div className="assessment-panel">
      <div className="assessment-head">
        <div>
          <span className="eyebrow">SYNTRA ASSESSMENT</span>
          <h2>{incident.title}</h2>
          <p>
            <Icon name="location_on" />{" "}
            {incident.location || "Location unavailable"}{" "}
            <span>·</span> {incident.id}
          </p>
        </div>
        <Badge tone={tone}>
          {(incident.severity || "unclassified").toUpperCase()}
        </Badge>
      </div>

      <div className="assessment-scroll">
        <div className="confidence-card">
          <div>
            <span>System Confidence</span>
            <strong>
              {incident.confidence != null
                ? `${Math.round(incident.confidence * 100)}%`
                : "—"}
            </strong>
          </div>

          <div className="confidence-bar">
            <i
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (incident.confidence || 0) * 100)
                )}%`,
              }}
            />
          </div>
        </div>

        <section>
          <div className="section-label">DECISION EVIDENCE</div>

          {incident.evidence?.length ? (
            <div className="evidence-list">
              {incident.evidence.map((e, i) => (
                <div className="evidence" key={i}>
                  <Icon
                    name={i % 2 ? "sensors" : "fact_check"}
                  />
                  <div>
                    <strong>
                      {typeof e === "string"
                        ? e
                        : e.factor || e.title || "Evidence"}
                    </strong>
                    {typeof e !== "string" &&
                      (e.detail || e.description) && (
                        <span>{e.detail || e.description}</span>
                      )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-box">
              No decision evidence recorded.
            </div>
          )}
        </section>

        <section>
          <div className="section-label">ASSESSMENT</div>
          <p className="assessment-text">
            {incident.assessment || "No assessment text recorded."}
          </p>
        </section>

        <section>
          <div className="section-label">
            RELATED SIGNALS · {linked.length}
          </div>

          {linked.length ? (
            linked.map((s) => (
              <div className="mini-signal" key={s.id}>
                <span>{s.id}</span>
                <span>{s.source}</span>
                <em>{formatTime(s.timestamp)}</em>
              </div>
            ))
          ) : (
            <div className="muted-box">No linked signals.</div>
          )}
        </section>

        {incident.recommended_actions?.length ? (
          <section>
            <div className="section-label">
              RECOMMENDED RESPONSE
            </div>

            <div className="actions-list">
              {incident.recommended_actions.map((a, i) => (
                <div key={i}>
                  <span className="action-num">
                    0{i + 1}
                  </span>
                  <div>
                    <strong>
                      {a.action || "Recommended action"}
                    </strong>
                    <small>
                      {a.responsible_role ||
                        "Role not specified"}
                    </small>
                  </div>
                  <Badge
                    tone={
                      a.priority === "urgent" ||
                      a.priority === "high"
                        ? "high"
                        : "neutral"
                    }
                  >
                    {a.priority || "proposed"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="section-label">AGENT TIMELINE</div>

          {events.length ? (
            <div className="event-timeline">
              {events.slice(0, 8).map((e) => (
                <div key={e.id}>
                  <span>{formatTime(e.timestamp)}</span>
                  <i
                    className={
                      e.status === "error" ? "error" : ""
                    }
                  />
                  <div>
                    <strong>{e.agent}</strong>
                    <small>
                      {e.output_summary || e.event_type}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-box">
              No agent events recorded.
            </div>
          )}
        </section>
      </div>

      {incident.status === "pending_approval" && (
        <div className="approval-bar">
          <div>
            <span>HUMAN APPROVAL REQUIRED</span>
            <small>
              SYNTRA proposes; an operator decides.
            </small>
          </div>

          <div className="approval-actions">
            <button
              className="button reject"
              disabled={busy}
              onClick={onReject}
              type="button"
            >
              REJECT
            </button>

            <button
              className="button approve"
              disabled={busy}
              onClick={onApprove}
              type="button"
            >
              <Icon name="verified" />{" "}
              {busy ? "PROCESSING" : "APPROVE RESPONSE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommandCenter({ data, refresh }) {
  const { health, signals, incidents, agents, events } = data;
  const [selectedId, setSelectedId] = useState(
    incidents[0]?.id || null
  );
  const [selected, setSelected] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedId && incidents[0]) {
      setSelectedId(incidents[0].id);
    }
  }, [incidents, selectedId]);

  useEffect(() => {
    (async () => {
      if (!selectedId) {
        setSelected(null);
        setSelectedEvents([]);
        return;
      }

      try {
        const [inc, ev] = await Promise.all([
          getIncident(selectedId),
          listAgentEvents(selectedId),
        ]);

        setSelected(inc);
        setSelectedEvents(ev);
      } catch {
        setSelected(null);
        setSelectedEvents([]);
      }
    })();
  }, [selectedId]);

  const activeIncidents = incidents.filter(
    (i) =>
      !["rejected", "resolved", "closed"].includes(
        i.status
      )
  );

  const criticalSignals = signals.filter(
    (s) => s.severity === "critical"
  ).length;

  const approve = async () => {
    if (!selected) return;

    setBusy(true);

    try {
      await approveIncident(selected.id, "operator");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected) return;

    setBusy(true);

    try {
      await rejectIncident(selected.id, "operator");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page command-page">
      <PageHeader
        eyebrow="OPERATIONS"
        title="Operations Command Center"
        subtitle="Understand what is happening. Coordinate what happens next."
        actions={
          <div className="system-card">
            <span>System Status</span>
            <strong>
              <i
                className={`status-dot ${
                  health?.status === "ok"
                    ? "online"
                    : "offline"
                }`}
              />
              {health?.status === "ok"
                ? "OPERATIONAL"
                : "DEGRADED"}
            </strong>
          </div>
        }
      />

      <div className="metrics">
        <Metric
          label="Active Incidents"
          value={String(activeIncidents.length).padStart(
            2,
            "0"
          )}
        />

        <Metric
          label="Critical Signals"
          value={String(criticalSignals).padStart(2, "0")}
          tone={
            criticalSignals ? "critical" : "neutral"
          }
        />

        <Metric
          label="Agents Registered"
          value={String(agents.length).padStart(2, "0")}
          tone="ai"
        />

        <Metric
          label="Signals Received"
          value={String(signals.length).padStart(2, "0")}
          hint="Persisted records"
        />
      </div>

      <div className="command-grid">
        <div className="command-main">
          <CorrelationGraph
            signals={signals}
            selectedIncident={selected}
          />

          <div className="incident-strip">
            <div className="panel-title">
              <div>
                <span className="eyebrow">
                  ACTIVE INCIDENTS
                </span>
                <h3>Select an incident</h3>
              </div>
              <span>{incidents.length} total</span>
            </div>

            {incidents.length ? (
              <div className="incident-row">
                {incidents.slice(0, 5).map((i) => (
                  <button
                    key={i.id}
                    className={
                      selectedId === i.id
                        ? "incident-chip selected"
                        : "incident-chip"
                    }
                    onClick={() =>
                      setSelectedId(i.id)
                    }
                    type="button"
                  >
                    <span>{i.id}</span>
                    <strong>{i.title}</strong>
                    <Badge
                      tone={severityTone(i.severity)}
                    >
                      {i.severity || "unclassified"}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="warning"
                title="No incidents detected"
              >
                Correlated signals will appear here.
              </EmptyState>
            )}
          </div>
        </div>

        <AssessmentPanel
          incident={selected}
          signals={signals}
          events={selectedEvents}
          onApprove={approve}
          onReject={reject}
          busy={busy}
        />
      </div>

      <div className="agent-flow-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">ORCHESTRATION</span>
            <h3>Live Agent Activity Flow</h3>
          </div>
          <span>
            {events.length
              ? `${events.length} events on selected incident`
              : "Waiting for activity"}
          </span>
        </div>

        <AgentFlow
          events={
            events.length ? events : data.events
          }
        />
      </div>
    </div>
  );
}

function SignalForm({ onCreated }) {
  const [form, setForm] = useState({
    source: "Resident Report",
    location: "",
    description: "",
    severity: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await createSignal({
        ...form,
        severity: form.severity || null,
      });

      setForm({
        ...form,
        description: "",
      });

      await onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-panel" onSubmit={submit}>
      <div className="panel-title">
        <div>
          <span className="eyebrow">INGESTION</span>
          <h3>Submit a signal</h3>
        </div>
        <Badge tone="ai">LIVE API</Badge>
      </div>

      <div className="form-grid">
        <label>
          Source
          <input
            value={form.source}
            onChange={(e) =>
              setForm({
                ...form,
                source: e.target.value,
              })
            }
            required
          />
        </label>

        <label>
          Location
          <input
            placeholder="e.g. Block B"
            value={form.location}
            onChange={(e) =>
              setForm({
                ...form,
                location: e.target.value,
              })
            }
          />
        </label>

        <label>
          Severity
          <select
            value={form.severity}
            onChange={(e) =>
              setForm({
                ...form,
                severity: e.target.value,
              })
            }
          >
            <option value="">Auto / unknown</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        <label className="wide">
          Description
          <textarea
            rows="4"
            placeholder="Describe the observed signal…"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            required
          />
        </label>
      </div>

      {error && (
        <div className="form-error">{error}</div>
      )}

      <button
        className="button primary"
        disabled={busy}
        type="submit"
      >
        {busy ? "SUBMITTING…" : "SUBMIT SIGNAL"}
        <Icon name="arrow_forward" />
      </button>
    </form>
  );
}

function SignalsPage({ data, refresh }) {
  const [selectedId, setSelectedId] = useState(
    data.signals[0]?.id || null
  );
  const [query, setQuery] = useState("");

  const selected =
    data.signals.find((s) => s.id === selectedId) ||
    null;

  const filtered = data.signals.filter((s) =>
    `${s.id} ${s.source} ${s.location} ${
      s.description
    } ${s.type || ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!selectedId && data.signals[0]) {
      setSelectedId(data.signals[0].id);
    }
  }, [data.signals, selectedId]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="TELEMETRY"
        title="Signals"
        subtitle="Incoming reports and observations, persisted and processed by SYNTRA."
      />

      <div className="signal-layout">
        <div>
          <SignalForm onCreated={refresh} />

          <div className="list-panel">
            <div className="toolbar">
              <div className="search-input">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(e) =>
                    setQuery(e.target.value)
                  }
                  placeholder="Search signals…"
                  aria-label="Search signals"
                />
              </div>
              <span>{filtered.length} records</span>
            </div>

            {filtered.length ? (
              <div className="signal-list">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    className={
                      selectedId === s.id
                        ? "signal-card selected"
                        : "signal-card"
                    }
                    onClick={() =>
                      setSelectedId(s.id)
                    }
                    type="button"
                  >
                    <div className="signal-card-top">
                      <span>{s.id}</span>
                      <Badge
                        tone={severityTone(
                          s.severity
                        )}
                      >
                        {s.severity || s.status}
                      </Badge>
                    </div>

                    <strong>{s.description}</strong>

                    <div>
                      <span>
                        <Icon name="source" />
                        {s.source}
                      </span>
                      <span>
                        <Icon name="location_on" />
                        {s.location || "Unspecified"}
                      </span>
                      <span>
                        {formatTime(s.timestamp)}
                      </span>
                    </div>

                    {s.incident_id && (
                      <em>↳ {s.incident_id}</em>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="sensors"
                title="No matching signals"
              >
                Submit a signal to begin ingestion.
              </EmptyState>
            )}
          </div>
        </div>

        <SignalDetail signal={selected} />
      </div>
    </div>
  );
}

function SignalDetail({ signal }) {
  if (!signal) {
    return (
      <div className="detail-panel">
        <EmptyState
          icon="sensors"
          title="Select a signal"
        >
          Choose a record from the live feed.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <div className="detail-head">
        <div>
          <span className="eyebrow">SIGNAL RECORD</span>
          <h2>{signal.id}</h2>
        </div>

        <Badge tone={severityTone(signal.severity)}>
          {signal.status}
        </Badge>
      </div>

      <div className="detail-body">
        <div className="detail-kv">
          <span>Source</span>
          <strong>{signal.source}</strong>
        </div>

        <div className="detail-kv">
          <span>Type</span>
          <strong>
            {signal.type || "Not classified"}
          </strong>
        </div>

        <div className="detail-kv">
          <span>Location</span>
          <strong>
            {signal.location || "Not provided"}
          </strong>
        </div>

        <div className="detail-kv">
          <span>Received</span>
          <strong>{formatDate(signal.timestamp)}</strong>
        </div>

        <section>
          <div className="section-label">OBSERVATION</div>
          <p className="large-copy">{signal.description}</p>
        </section>

        <section>
          <div className="section-label">
            INCIDENT LINK
          </div>

          {signal.incident_id ? (
            <div className="linked-incident">
              <Icon name="hub" />
              <strong>{signal.incident_id}</strong>
              <span>Correlated incident</span>
            </div>
          ) : (
            <div className="muted-box">
              Not correlated to an incident.
            </div>
          )}
        </section>

        <section>
          <div className="section-label">METADATA</div>
          <pre className="metadata">
            {JSON.stringify(
              signal.metadata || {},
              null,
              2
            )}
          </pre>
        </section>
      </div>
    </div>
  );
}

function IncidentsPage({ data, refresh }) {
  const [selectedId, setSelectedId] = useState(
    data.incidents[0]?.id || null
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [busy, setBusy] = useState(false);

  const filtered = data.incidents.filter((i) =>
    `${i.id} ${i.title} ${i.location || ""} ${
      i.status
    }`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    (async () => {
      if (!selectedId) return;

      try {
        const [i, ev, tl] = await Promise.all([
          getIncident(selectedId),
          listAgentEvents(selectedId),
          getIncidentTimeline(selectedId),
        ]);

        setSelected(i);
        setEvents(ev);
        setTimeline(tl);
      } catch {
        setSelected(null);
        setEvents([]);
        setTimeline([]);
      }
    })();
  }, [selectedId]);

  const act = async (fn) => {
    if (!selected) return;

    setBusy(true);

    try {
      await fn(selected.id, "operator");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="INCIDENT MANAGEMENT"
        title="Incidents"
        subtitle="Correlated situations requiring operational awareness or human review."
      />

      <div className="toolbar wide-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            placeholder="Search by ID, title, location…"
            aria-label="Search incidents"
          />
        </div>
        <span>{filtered.length} incidents</span>
      </div>

      <div className="split-layout">
        <div className="incident-list">
          {filtered.length ? (
            filtered.map((i) => (
              <button
                key={i.id}
                className={
                  selectedId === i.id
                    ? "incident-list-card selected"
                    : "incident-list-card"
                }
                onClick={() =>
                  setSelectedId(i.id)
                }
                type="button"
              >
                <div>
                  <span>{i.id}</span>
                  <Badge
                    tone={severityTone(i.severity)}
                  >
                    {i.severity || "unclassified"}
                  </Badge>
                </div>

                <h3>{i.title}</h3>
                <p>
                  {i.assessment ||
                    "No assessment recorded."}
                </p>

                <footer>
                  <span>
                    {i.location ||
                      "Location unavailable"}
                  </span>
                  <span>{i.status}</span>
                </footer>
              </button>
            ))
          ) : (
            <EmptyState
              icon="warning"
              title="No incidents"
            >
              No incident records match the current
              filter.
            </EmptyState>
          )}
        </div>

        <IncidentDetail
          incident={selected}
          events={events}
          timeline={timeline}
          busy={busy}
          onApprove={() => act(approveIncident)}
          onReject={() => act(rejectIncident)}
        />
      </div>
    </div>
  );
}

function IncidentDetail({
  incident,
  events,
  timeline,
  busy,
  onApprove,
  onReject,
}) {
  if (!incident) {
    return (
      <div className="detail-panel">
        <EmptyState
          icon="warning"
          title="Select an incident"
        >
          Choose an incident to inspect.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="detail-panel incident-detail">
      <div className="detail-head">
        <div>
          <span className="eyebrow">INCIDENT</span>
          <h2>{incident.title}</h2>
          <p>
            {incident.id} ·{" "}
            {incident.location ||
              "Location unavailable"}
          </p>
        </div>

        <Badge
          tone={severityTone(incident.severity)}
        >
          {incident.status}
        </Badge>
      </div>

      <div className="detail-body">
        <div className="incident-stats">
          <div>
            <span>Severity</span>
            <strong>
              {incident.severity || "—"}
            </strong>
          </div>

          <div>
            <span>Confidence</span>
            <strong>
              {incident.confidence != null
                ? `${Math.round(
                    incident.confidence * 100
                  )}%`
                : "—"}
            </strong>
          </div>

          <div>
            <span>Signals</span>
            <strong>
              {incident.signal_ids?.length || 0}
            </strong>
          </div>
        </div>

        <section>
          <div className="section-label">
            EXECUTIVE ASSESSMENT
          </div>
          <p className="large-copy">
            {incident.assessment ||
              "No assessment recorded."}
          </p>
        </section>

        <section>
          <div className="section-label">
            DECISION EVIDENCE
          </div>

          {incident.evidence?.length ? (
            <ul className="plain-list">
              {incident.evidence.map((e, i) => (
                <li key={i}>
                  <Icon name="check_circle" />
                  {typeof e === "string"
                    ? e
                    : e.factor ||
                      e.title ||
                      JSON.stringify(e)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted-box">
              No evidence recorded.
            </div>
          )}
        </section>

        <section>
          <div className="section-label">
            RESPONSE PROPOSAL
          </div>

          {incident.recommended_actions?.length ? (
            <div className="actions-list">
              {incident.recommended_actions.map(
                (a, i) => (
                  <div key={i}>
                    <span className="action-num">
                      0{i + 1}
                    </span>
                    <div>
                      <strong>{a.action}</strong>
                      <small>
                        {a.responsible_role ||
                          "Unspecified role"}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="muted-box">
              No response proposal recorded.
            </div>
          )}
        </section>

        <section>
          <div className="section-label">
            AUDIT TIMELINE
          </div>

          {timeline.length ? (
            <div className="event-timeline">
              {timeline.map((t) => (
                <div key={t.id}>
                  <span>{formatTime(t.timestamp)}</span>
                  <i />
                  <div>
                    <strong>{t.event}</strong>
                    <small>
                      {t.actor || "SYNTRA"}
                      {t.details
                        ? ` · ${t.details}`
                        : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-box">
              No timeline events.
            </div>
          )}
        </section>

        <section>
          <div className="section-label">
            AGENT EVENTS
          </div>

          {events.length ? (
            events.map((e) => (
              <div className="event-row" key={e.id}>
                <Icon
                  name={
                    AGENT_ICONS[e.agent] ||
                    "smart_toy"
                  }
                />

                <div>
                  <strong>
                    {e.agent} · {e.event_type}
                  </strong>
                  <span>
                    {e.output_summary ||
                      "No summary"}
                  </span>
                </div>

                <Badge
                  tone={
                    e.status === "error"
                      ? "critical"
                      : "neutral"
                  }
                >
                  {e.mode} · {e.status}
                </Badge>
              </div>
            ))
          ) : (
            <div className="muted-box">
              No agent events.
            </div>
          )}
        </section>
      </div>

      {incident.status === "pending_approval" && (
        <div className="approval-bar">
          <div>
            <span>HUMAN APPROVAL REQUIRED</span>
            <small>
              Approval is recorded in the audit trail.
            </small>
          </div>

          <div className="approval-actions">
            <button
              className="button reject"
              disabled={busy}
              onClick={onReject}
              type="button"
            >
              REJECT
            </button>

            <button
              className="button approve"
              disabled={busy}
              onClick={onApprove}
              type="button"
            >
              APPROVE RESPONSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentsPage({ data }) {
  const events = data.events;

  const latest = useMemo(() => {
    const m = {};

    events.forEach((e) => {
      if (!m[e.agent]) m[e.agent] = e;
    });

    return m;
  }, [events]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="ORCHESTRATION"
        title="Agent Activity"
        subtitle="Observable agent execution, status, mode, and audit events."
      />

      <div className="agent-visual">
        <AgentFlow events={events} />
      </div>

      <div className="agent-cards">
        {data.agents.map((a) => {
          const e = latest[a.name];

          return (
            <div className="agent-card" key={a.name}>
              <div className="agent-card-icon">
                <Icon
                  name={
                    AGENT_ICONS[a.name] ||
                    "smart_toy"
                  }
                />
              </div>

              <div>
                <span className="eyebrow">
                  {a.mode === "fixture"
                    ? "FIXTURE MODE"
                    : "AI MODE"}
                </span>

                <h3>{a.name} Agent</h3>
                <p>{a.role}</p>

                <div className="agent-meta">
                  <Badge
                    tone={
                      a.mode === "fixture"
                        ? "fixture"
                        : "ai"
                    }
                  >
                    {a.mode}
                  </Badge>

                  <span>
                    {e
                      ? `${e.status} · ${formatTime(
                          e.timestamp
                        )}`
                      : "No recorded event"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="event-stream">
        <div className="panel-title">
          <div>
            <span className="eyebrow">AUDIT LOG</span>
            <h3>Live Event Stream</h3>
          </div>

          <Badge tone="ai">
            {events.length} EVENTS
          </Badge>
        </div>

        {events.length ? (
          events.map((e) => (
            <div className="stream-event" key={e.id}>
              <time>{formatTime(e.timestamp)}</time>

              <div className="stream-icon">
                <Icon
                  name={
                    AGENT_ICONS[e.agent] ||
                    "smart_toy"
                  }
                />
              </div>

              <div className="stream-content">
                <strong>
                  {e.agent}{" "}
                  <span>· {e.event_type}</span>
                </strong>

                <p>
                  {e.output_summary ||
                    (e.error
                      ? `Error: ${e.error}`
                      : "Event recorded.")}
                </p>

                <div>
                  <Badge
                    tone={
                      e.mode === "fixture"
                        ? "fixture"
                        : "ai"
                    }
                  >
                    {e.mode}
                  </Badge>

                  <Badge
                    tone={
                      e.status === "error"
                        ? "critical"
                        : "neutral"
                    }
                  >
                    {e.status}
                  </Badge>

                  {e.incident_id && (
                    <span>{e.incident_id}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon="smart_toy"
            title="No agent events"
          >
            Agent events appear when signals are
            processed.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

function AnalyticsPage({ data }) {
  const { signals, incidents, events } = data;

  const severityCounts = Object.fromEntries(
    Object.keys(SEVERITY).map((s) => [
      s,
      incidents.filter((i) => i.severity === s)
        .length,
    ])
  );

  const statusCounts = {};

  incidents.forEach((i) => {
    statusCounts[i.status] =
      (statusCounts[i.status] || 0) + 1;
  });

  const maxSeverity = Math.max(
    1,
    ...Object.values(severityCounts)
  );

  const successEvents = events.filter(
    (e) => e.status === "completed"
  ).length;

  const errors = events.filter(
    (e) => e.status === "error"
  ).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="SYSTEM ANALYTICS"
        title="Analytics"
        subtitle="Metrics derived from SYNTRA's persisted records. No synthetic trends."
      />

      <div className="metrics">
        <Metric label="Signals" value={signals.length} />
        <Metric
          label="Incidents"
          value={incidents.length}
        />
        <Metric
          label="Completed Agent Events"
          value={successEvents}
          tone="ai"
        />
        <Metric
          label="Agent Errors"
          value={errors}
          tone={errors ? "critical" : "neutral"}
        />
      </div>

      <div className="analytics-grid">
        <div className="chart-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">
                INCIDENT SEVERITY
              </span>
              <h3>Observed distribution</h3>
            </div>
          </div>

          <div className="bars">
            {Object.entries(severityCounts).map(
              ([s, n]) => (
                <div className="bar-row" key={s}>
                  <span>{s}</span>
                  <div>
                    <i
                      className={s}
                      style={{
                        width: `${
                          (n / maxSeverity) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <strong>{n}</strong>
                </div>
              )
            )}
          </div>
        </div>

        <div className="chart-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">
                INCIDENT STATUS
              </span>
              <h3>Current state</h3>
            </div>
          </div>

          <div className="status-list">
            {Object.entries(statusCounts).length ? (
              Object.entries(statusCounts).map(
                ([s, n]) => (
                  <div key={s}>
                    <span>
                      {s.replaceAll("_", " ")}
                    </span>
                    <strong>{n}</strong>
                  </div>
                )
              )
            ) : (
              <EmptyState
                icon="analytics"
                title="Insufficient data"
              >
                Create signals to generate incident
                metrics.
              </EmptyState>
            )}
          </div>
        </div>

        <div className="chart-panel full">
          <div className="panel-title">
            <div>
              <span className="eyebrow">
                AGENT HEALTH
              </span>
              <h3>Recorded execution outcomes</h3>
            </div>

            <Badge tone="fixture">
              SOURCE · DATABASE
            </Badge>
          </div>

          <div className="health-grid">
            {data.agents.map((a) => {
              const ae = events.filter(
                (e) => e.agent === a.name
              );

              const failures = ae.filter(
                (e) => e.status === "error"
              ).length;

              return (
                <div key={a.name}>
                  <span>{a.name}</span>
                  <strong>{ae.length}</strong>
                  <small>
                    {failures
                      ? `${failures} failed`
                      : "No recorded failures"}
                  </small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPage({ data }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    data.incidents[0]?.id || null
  );

  const filtered = data.incidents.filter((i) =>
    `${i.id} ${i.title} ${i.location || ""} ${
      i.assessment || ""
    }`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = data.incidents.find(
    (i) => i.id === selectedId
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="HISTORICAL CONTEXT"
        title="History"
        subtitle="Recorded incidents and their operational context."
      />

      <div className="toolbar wide-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            placeholder="Search by ID, keyword, or location…"
            aria-label="Search history"
          />
        </div>

        <span>{filtered.length} records</span>
      </div>

      <div className="history-grid">
        <div className="history-list">
          {filtered.length ? (
            filtered.map((i) => (
              <button
                key={i.id}
                className={
                  selectedId === i.id
                    ? "history-card selected"
                    : "history-card"
                }
                onClick={() =>
                  setSelectedId(i.id)
                }
                type="button"
              >
                <div>
                  <span>{i.id}</span>
                  <Badge
                    tone={
                      i.status === "rejected"
                        ? "critical"
                        : "low"
                    }
                  >
                    {i.status}
                  </Badge>
                </div>

                <h3>{i.title}</h3>
                <p>
                  {i.assessment ||
                    "No assessment recorded."}
                </p>

                <footer>
                  {i.location ||
                    "Location unavailable"}{" "}
                  · {formatDate(i.updated_at)}
                </footer>
              </button>
            ))
          ) : (
            <EmptyState
              icon="history"
              title="No historical records"
            >
              There are no incidents matching your
              search.
            </EmptyState>
          )}
        </div>

        {selected ? (
          <div className="history-detail">
            <div className="detail-head">
              <div>
                <span className="eyebrow">
                  RECORDED INCIDENT
                </span>
                <h2>{selected.title}</h2>
                <p>
                  {selected.id} · created{" "}
                  {formatDate(selected.created_at)}
                </p>
              </div>

              <Badge
                tone={
                  selected.status === "rejected"
                    ? "critical"
                    : "low"
                }
              >
                {selected.status}
              </Badge>
            </div>

            <div className="detail-body">
              <section>
                <div className="section-label">
                  SUMMARY
                </div>
                <p className="large-copy">
                  {selected.assessment ||
                    "No summary recorded."}
                </p>
              </section>

              <section>
                <div className="section-label">
                  EVIDENCE
                </div>

                {selected.evidence?.length ? (
                  <ul className="plain-list">
                    {selected.evidence.map((e, i) => (
                      <li key={i}>
                        <Icon name="fact_check" />
                        {typeof e === "string"
                          ? e
                          : e.factor ||
                            e.title ||
                            JSON.stringify(e)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted-box">
                    No evidence recorded.
                  </div>
                )}
              </section>

              <section>
                <div className="section-label">
                  SIGNALS
                </div>

                <div className="signal-id-grid">
                  {(selected.signal_ids || []).map(
                    (id) => (
                      <span key={id}>{id}</span>
                    )
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="history-detail">
            <EmptyState
              icon="history"
              title="Select a record"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ title, icon, onClose, children }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="modal-icon">
              <Icon name={icon} />
            </span>
            <h2 id="modal-title">{title}</h2>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function SupportModal({ onClose }) {
  return (
    <Modal
      title="SYNTRA Support"
      icon="help"
      onClose={onClose}
    >
      <p className="modal-lead">
        Operational guidance for the SYNTRA command
        interface.
      </p>

      <div className="support-list">
        <div>
          <Icon name="sensors" />
          <div>
            <strong>Submit a signal</strong>
            <span>
              Use Signals to submit a real observation
              through the backend API.
            </span>
          </div>
        </div>

        <div>
          <Icon name="warning" />
          <div>
            <strong>Review incidents</strong>
            <span>
              Correlated signals become incidents that
              can require human approval.
            </span>
          </div>
        </div>

        <div>
          <Icon name="smart_toy" />
          <div>
            <strong>Inspect agent activity</strong>
            <span>
              Agent events are recorded in the database
              for traceability.
            </span>
          </div>
        </div>
      </div>

      <div className="modal-note">
        <Icon name="info" />
        <span>
          SYNTRA is connected to its configured backend.
          It does not use fabricated operational data.
        </span>
      </div>
    </Modal>
  );
}

function SettingsModal({ health, onClose }) {
  return (
    <Modal
      title="System Settings"
      icon="settings"
      onClose={onClose}
    >
      <div className="settings-grid">
        <div className="setting-row">
          <div>
            <strong>Backend status</strong>
            <span>
              Current API health state.
            </span>
          </div>
          <Badge
            tone={
              health?.status === "ok"
                ? "ai"
                : "critical"
            }
          >
            {health?.status === "ok"
              ? "OPERATIONAL"
              : "DEGRADED"}
          </Badge>
        </div>

        <div className="setting-row">
          <div>
            <strong>AI execution mode</strong>
            <span>
              Mode reported directly by the backend.
            </span>
          </div>
          <Badge
            tone={
              health?.ai_mode === "anthropic"
                ? "ai"
                : "fixture"
            }
          >
            {health?.ai_mode === "anthropic"
              ? "AI · LIVE"
              : "FIXTURE · DEVELOPMENT"}
          </Badge>
        </div>

        <div className="setting-row">
          <div>
            <strong>Data source</strong>
            <span>
              Operational records are loaded from the
              SYNTRA API.
            </span>
          </div>
          <span className="setting-value">
            DATABASE / API
          </span>
        </div>

        <div className="setting-row">
          <div>
            <strong>Refresh interval</strong>
            <span>
              The interface checks the API periodically
              for updates.
            </span>
          </div>
          <span className="setting-value">
            10 seconds
          </span>
        </div>
      </div>
    </Modal>
  );
}

function App() {
  const [active, setActive] = useState(
    () =>
      window.location.hash.replace("#", "") ||
      "command"
  );

  const [data, setData] = useState({
    health: null,
    signals: [],
    incidents: [],
    agents: [],
    events: [],
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const navigate = (page) => {
    setActive(page);
    window.location.hash = page;
  };

  const refresh = useCallback(async () => {
    try {
      const [
        health,
        signals,
        incidents,
        agents,
        events,
      ] = await Promise.all([
        getHealth(),
        listSignals(),
        listIncidents(),
        listAgents(),
        listAgentEvents(),
      ]);

      setData({
        health,
        signals,
        incidents,
        agents,
        events,
      });

      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const timer = setInterval(refresh, 10000);

    const hash = () =>
      setActive(
        window.location.hash.replace("#", "") ||
          "command"
      );

    window.addEventListener("hashchange", hash);

    return () => {
      clearInterval(timer);
      window.removeEventListener(
        "hashchange",
        hash
      );
    };
  }, [refresh]);

  const page =
    active === "incidents" ? (
      <IncidentsPage data={data} refresh={refresh} />
    ) : active === "signals" ? (
      <SignalsPage data={data} refresh={refresh} />
    ) : active === "agents" ? (
      <AgentsPage data={data} />
    ) : active === "analytics" ? (
      <AnalyticsPage data={data} />
    ) : active === "history" ? (
      <HistoryPage data={data} />
    ) : (
      <CommandCenter data={data} refresh={refresh} />
    );

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={navigate}
        onSupport={() => setModal("support")}
        onSettings={() => setModal("settings")}
      />

      <div className="workspace">
        <SystemHeader
          health={data.health}
          active={active}
          onNavigate={navigate}
        />

        <main className="content">
          {error && (
            <div className="global-error">
              <Icon name="cloud_off" />
              <span>
                Backend unavailable: {error}
              </span>
              <button
                onClick={refresh}
                type="button"
              >
                RETRY
              </button>
            </div>
          )}

          {loading ? (
            <div className="page">
              <LoadingState label="Connecting to SYNTRA" />
            </div>
          ) : (
            page
          )}
        </main>
      </div>

      <MobileNav
        active={active}
        onNavigate={navigate}
      />

      {modal === "support" && (
        <SupportModal
          onClose={() => setModal(null)}
        />
      )}

      {modal === "settings" && (
        <SettingsModal
          health={data.health}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default App;
