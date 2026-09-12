import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  runElectricalFireDemo,
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

/**
 * Self-contained inline SVG icon system. Deliberately replaces a
 * Google-Fonts-ligature approach (Material Symbols) after confirming in a
 * real deployed browser that the font request can fail, causing icon
 * *names* to render as literal fallback text — e.g. "warning", "smart_toy",
 * "hub" appearing as giant words instead of icons. Inline SVG has no
 * external font dependency, so it cannot fail this way.
 *
 * Built from simple primitives (circles/rects/lines) rather than complex
 * bezier paths wherever possible, since these are easy to reason about
 * correctly without a way to visually preview them.
 */
const ICONS = {
  dashboard: () => (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  warning: () => (
    <>
      <path d="M12 3.5 L21.5 20 H2.5 Z" strokeLinejoin="round" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  sensors: () => (
    <>
      <circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <path d="M6 18 A8 8 0 0 0 14 10" />
      <path d="M6 18 A12 12 0 0 0 18 6" />
    </>
  ),
  smart_toy: () => (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <line x1="12" y1="8" x2="12" y2="4.5" />
      <circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </>
  ),
  leaderboard: () => (
    <>
      <rect x="4" y="12" width="4.5" height="8" rx="0.8" />
      <rect x="10" y="6" width="4.5" height="14" rx="0.8" />
      <rect x="16" y="9.5" width="4.5" height="10.5" rx="0.8" />
    </>
  ),
  history: () => (
    <>
      <circle cx="12" cy="13" r="8" />
      <line x1="12" y1="13" x2="12" y2="8.5" />
      <line x1="12" y1="13" x2="15" y2="14.5" />
      <path d="M4.5 6 L4.5 9.5 L8 9.5" />
    </>
  ),
  help: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5 a2.6 2.4 0 1 1 4 2 c-1 0.7 -1.5 1.3 -1.5 2.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  settings: () => (
    <>
      <circle cx="12" cy="12" r="3.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="4.2"
          x2="12"
          y2="6.3"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </>
  ),
  search: () => (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.3" y1="15.3" x2="20.5" y2="20.5" />
    </>
  ),
  notifications: () => (
    <>
      <path d="M6 16 V11 a6 6 0 0 1 12 0 V16 l2 2.5 H4 Z" strokeLinejoin="round" />
      <path d="M10 20 a2 2 0 0 0 4 0" />
    </>
  ),
  close: () => (
    <>
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </>
  ),
  account_circle: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="9.8" r="2.8" />
      <path d="M5.5 18.5 a7 5.4 0 0 1 13 0" />
    </>
  ),
  cloud_off: () => (
    <>
      <path d="M7.5 17 h9 a4 4 0 0 0 0.5 -7.9 A6 6 0 0 0 5.8 12.2 A3.7 3.7 0 0 0 7.5 17 Z" />
      <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" />
    </>
  ),
  info: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  check_circle: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="8,12.3 10.8,15 16,9.3" strokeLinejoin="round" />
    </>
  ),
  location_on: () => (
    <>
      <path d="M12 21 C8 16.5 5.5 13.2 5.5 10 a6.5 6.5 0 0 1 13 0 C18.5 13.2 16 16.5 12 21 Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  hub: () => (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="4" r="1.8" />
      <circle cx="5" cy="18.5" r="1.8" />
      <circle cx="19" cy="18.5" r="1.8" />
      <line x1="12" y1="9.6" x2="12" y2="5.8" />
      <line x1="10.2" y1="13.6" x2="6" y2="17" />
      <line x1="13.8" y1="13.6" x2="18" y2="17" />
    </>
  ),
  source: () => (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.2" />
      <line x1="8" y1="8.5" x2="16" y2="8.5" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="15.5" x2="13" y2="15.5" />
    </>
  ),
  verified: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="8,12.3 10.8,15 16,9.3" strokeLinejoin="round" />
    </>
  ),
  verified_user: () => (
    <>
      <path d="M12 3.5 L19 6.5 V12 c0 4.5 -3 7.5 -7 8.5 c-4 -1 -7 -4 -7 -8.5 V6.5 Z" strokeLinejoin="round" />
      <polyline points="8.5,12 10.8,14.3 15.5,9.5" strokeLinejoin="round" />
    </>
  ),
  arrow_forward: () => (
    <>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13,6.5 19,12 13,17.5" strokeLinejoin="round" />
    </>
  ),
  fact_check: () => (
    <>
      <rect x="4.5" y="4" width="15" height="17" rx="1.2" />
      <rect x="9" y="2.3" width="6" height="3" rx="0.8" fill="currentColor" stroke="none" />
      <polyline points="7.5,11 9.2,12.8 12,9.5" strokeLinejoin="round" />
      <line x1="14" y1="11" x2="17" y2="11" />
      <line x1="7.5" y1="16.5" x2="17" y2="16.5" />
    </>
  ),
  input: () => (
    <>
      <path d="M9 4 H6 a1.5 1.5 0 0 0 -1.5 1.5 v13 A1.5 1.5 0 0 0 6 20 h3" />
      <line x1="8" y1="12" x2="19" y2="12" />
      <polyline points="15,8 19,12 15,16" strokeLinejoin="round" />
    </>
  ),
  gpp_maybe: () => (
    <>
      <path d="M12 3.5 L19 6.5 V12 c0 4.5 -3 7.5 -7 8.5 c-4 -1 -7 -4 -7 -8.5 V6.5 Z" strokeLinejoin="round" />
      <path d="M10.3 9.3 a2 1.8 0 1 1 3 1.6 c-0.8 0.5 -1.2 1 -1.2 2" />
      <circle cx="12" cy="15.3" r="0.85" fill="currentColor" stroke="none" />
    </>
  ),
  auto_fix_high: () => (
    <>
      <line x1="5" y1="19" x2="15.5" y2="8.5" />
      <path d="M19 3 l0.9 2.1 L22 6 l-2.1 0.9 L19 9 l-0.9 -2.1 L16 6 l2.1 -0.9 Z" strokeLinejoin="round" />
      <path d="M7 13 l0.6 1.4 L9 15 l-1.4 0.6 L7 17 l-0.6 -1.4 L5 15 l1.4 -0.6 Z" strokeLinejoin="round" />
    </>
  ),
  local_fire_department: () => (
    <>
      <path d="M12 21 c-3.5 0 -6 -2.3 -6 -5.6 c0 -2.3 1.3 -3.7 2.3 -5.2 c0.3 2 1.3 2.8 1.3 2.8 c-0.4 -3 1 -5.5 3 -7 c-0.4 2 0.4 3.3 1.6 4.6 c1.3 1.4 2.8 3 2.8 5 c0 3.1 -2.5 5.4 -5 5.4 Z" strokeLinejoin="round" />
    </>
  ),
  priority_high: () => (
    <>
      <line x1="12" y1="4" x2="12" y2="14.5" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  hourglass_top: () => (
    <>
      <line x1="6" y1="3.5" x2="18" y2="3.5" />
      <line x1="6" y1="20.5" x2="18" y2="20.5" />
      <path d="M7.5 3.5 v3 c0 2 1.6 3.6 4.5 5 c2.9 -1.4 4.5 -3 4.5 -5 v-3" strokeLinejoin="round" />
      <path d="M7.5 20.5 v-3 c0 -2 1.6 -3.6 4.5 -5 c2.9 1.4 4.5 3 4.5 5 v3" strokeLinejoin="round" />
    </>
  ),
  error: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  chevron_down: () => (
    <polyline points="6,9 12,15 18,9" strokeLinejoin="round" />
  ),
  delete: () => (
    <>
      <path d="M5.5 7.5 h13 l-1 12.5 a1.5 1.5 0 0 1 -1.5 1.4 h-8 a1.5 1.5 0 0 1 -1.5 -1.4 Z" strokeLinejoin="round" />
      <line x1="3.5" y1="7.5" x2="20.5" y2="7.5" />
      <path d="M9 7.5 V4.8 A1 1 0 0 1 10 3.8 h4 a1 1 0 0 1 1 1 v2.7" />
      <line x1="10" y1="11" x2="10" y2="16.5" />
      <line x1="14" y1="11" x2="14" y2="16.5" />
    </>
  ),
  lock: () => (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="1.6" />
      <path d="M8 10.5 V7.3 a4 4 0 0 1 8 0 v3.2" />
      <circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  mail: () => (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.6" />
      <polyline points="4,6.5 12,13 20,6.5" strokeLinejoin="round" />
    </>
  ),
};

function Icon({ name, fill = false }) {
  const draw = ICONS[name];
  return (
    <svg
      className="icon-svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={fill ? 1.4 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {draw ? draw() : <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function CloseButton({ onClose }) {
  return (
    <button
      type="button"
      className="close-button"
      onClick={onClose}
      aria-label="Close details"
    >
      <Icon name="close" />
    </button>
  );
}

/** Calls onClose when Escape is pressed, only while `active` is true. */
function useEscapeToClose(active, onClose) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

/**
 * Accessible custom dropdown replacing native <select> for the SYNTRA dark
 * UI (native selects render as an unstyleable browser-native white
 * rectangle on most platforms). Supports full keyboard interaction and
 * outside-click dismissal without any UI library.
 */
function Dropdown({ value, onChange, options, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selectedIndex = Math.max(
    options.findIndex((o) => o.value === value),
    0
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    function onDocPointer(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlight(selectedIndex);
      listRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onTriggerKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onListKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(options[highlight].value);
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className={`dropdown-trigger ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dropdown-trigger-content">
          {selected.tone && <i className={`legend-dot ${selected.tone}`} />}
          {selected.label}
        </span>
        <Icon name="chevron_down" />
      </button>

      {open && (
        <ul
          className="dropdown-menu"
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
          ref={listRef}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value || "auto"}
              role="option"
              aria-selected={opt.value === value}
              className={`dropdown-option ${
                i === highlight ? "highlighted" : ""
              } ${opt.value === value ? "selected" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.tone && <i className={`legend-dot ${opt.tone}`} />}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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

/** Derives operational notifications from already-loaded backend data only —
 * no separate endpoint, no fabricated events. Covers exactly what Phase 5
 * asked for: pending approvals, critical incidents, agent errors. */
function computeNotifications(data) {
  const items = [];

  (data.incidents || []).forEach((inc) => {
    if (inc.status === "pending_approval") {
      items.push({
        id: `pending-${inc.id}`,
        icon: "hourglass_top",
        tone: "warning",
        text: `${inc.id} is awaiting human approval`,
        timestamp: inc.updated_at,
      });
    }
    if (inc.severity === "critical" && inc.status !== "rejected") {
      items.push({
        id: `critical-${inc.id}`,
        icon: "warning",
        tone: "critical",
        text: `${inc.id} assessed as CRITICAL — ${inc.title}`,
        timestamp: inc.updated_at,
      });
    }
  });

  (data.events || []).forEach((e) => {
    if (e.status === "error") {
      items.push({
        id: `error-${e.id}`,
        icon: "error",
        tone: "critical",
        text: `${e.agent} failed: ${e.error || "unknown error"}`,
        timestamp: e.timestamp,
      });
    }
  });

  return items
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);
}

/** UI preferences only — never a substitute for real backend settings.
 * Persisted to localStorage; falls back silently to defaults if unavailable
 * (e.g. private browsing) rather than breaking the app. */
const PREFS_KEY = "syntra:preferences";
const DEFAULT_PREFS = {
  density: "comfortable",
  reducedMotion: false,
  autoRefresh: true,
  refreshInterval: 10,
  emailNotifications: true,
  inAppNotifications: true,
  maxApprovableRisk: 85,
};

function loadPreferences() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function usePreferences() {
  const [prefs, setPrefs] = useState(loadPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* localStorage unavailable — preferences simply won't persist */
    }
  }, [prefs]);

  const updatePrefs = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  return [prefs, updatePrefs];
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

function SystemHeader({ health, onNavigate, signals, incidents, notifications, onJumpToSignal, onJumpToIncident, onOperator }) {
  const ok = health?.status === "ok";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!notifOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notifOpen]);

  const q = query.trim().toLowerCase();
  const matchedSignals = q
    ? (signals || [])
        .filter((s) =>
          `${s.id} ${s.source} ${s.location || ""} ${s.description}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 5)
    : [];
  const matchedIncidents = q
    ? (incidents || [])
        .filter((i) =>
          `${i.id} ${i.title} ${i.location || ""} ${i.status}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 5)
    : [];
  const hasResults = matchedSignals.length > 0 || matchedIncidents.length > 0;

  const jump = (fn, id) => {
    fn(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <header className="topbar">
      <button
        className="mobile-brand"
        onClick={() => onNavigate("command")}
        aria-label="Go to Command Center"
      >
        <span>SYNTRA</span>
      </button>

      <div className="top-search top-search--relative">
        <Icon name="search" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
            if (e.key === "Enter") {
              const first = matchedSignals[0] || matchedIncidents[0];
              if (first) {
                if (matchedSignals[0] === first) jump(onJumpToSignal, first.id);
                else jump(onJumpToIncident, first.id);
              }
            }
          }}
          placeholder="Search signals or incidents…"
          aria-label="Search signals or incidents"
        />
        {open && q && (
          <div className="search-results">
            {hasResults ? (
              <>
                {matchedSignals.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => jump(onJumpToSignal, s.id)}
                  >
                    <Icon name="sensors" />
                    <span>
                      <strong>{s.id}</strong>
                      <em>{s.description}</em>
                    </span>
                  </button>
                ))}
                {matchedIncidents.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onMouseDown={() => jump(onJumpToIncident, i.id)}
                  >
                    <Icon name="warning" />
                    <span>
                      <strong>{i.id}</strong>
                      <em>{i.title}</em>
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="search-empty">No matches for "{query}"</div>
            )}
          </div>
        )}
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
        <div className="notif-wrapper">
          <button
            className="icon-button"
            title="Notifications"
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
          >
            <Icon name="notifications" />
            {notifications.length > 0 && (
              <span className="notif-count">{notifications.length}</span>
            )}
          </button>
          {notifOpen && (
            <div
              className="notif-panel"
              onMouseLeave={() => setNotifOpen(false)}
            >
              <div className="notif-panel-head">Operational Alerts</div>
              {notifications.length === 0 ? (
                <div className="search-empty">No new operational alerts</div>
              ) : (
                <ul>
                  {notifications.map((n) => (
                    <li key={n.id} className={`notif-item tone-${n.tone}`}>
                      <Icon name={n.icon} />
                      <div>
                        <span>{n.text}</span>
                        <em>{formatTime(n.timestamp)}</em>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          className="icon-button"
          title="Operator"
          type="button"
          onClick={onOperator}
        >
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

const AGENT_ORDER = ["Intake", "Correlation", "Risk", "Response", "Supervisor"];

const AGENT_FALLBACK_ROLE = {
  Intake: "Normalizes newly submitted signals",
  Correlation: "Links related signals into candidate incidents",
  Risk: "Assesses severity, confidence, and evidence",
  Response: "Generates a recommended, human-approved response plan",
  Supervisor: "Coordinates the workflow and enforces human approval",
};

function AgentFlow({ events, agents, incidents }) {
  const [selected, setSelected] = useState(null);
  useEscapeToClose(Boolean(selected), () => setSelected(null));

  const latest = useMemo(() => {
    const m = {};
    events.forEach((e) => {
      if (!m[e.agent]) m[e.agent] = e;
    });
    return m;
  }, [events]);

  const pendingApproval = (incidents || []).some(
    (i) => i.status === "pending_approval"
  );
  const hasActivity = events.length > 0;

  const stages = AGENT_ORDER.map((name, i) => {
    const event = latest[name];
    let state = "idle";
    if (name === "Supervisor" && pendingApproval) {
      state = "human-review";
    } else if (event?.status === "error") {
      state = "error";
    } else if (event?.status === "completed") {
      state = "complete";
    }
    return {
      name,
      number: i + 1,
      icon: AGENT_ICONS[name],
      event,
      state,
      role:
        agents?.find((a) => a.name === name)?.role ||
        AGENT_FALLBACK_ROLE[name],
    };
  });

  const selectedStage = stages.find((s) => s.name === selected);

  const STATE_LABEL = {
    idle: "IDLE",
    complete: "COMPLETE",
    error: "ERROR",
    "human-review": "HUMAN REVIEW",
  };

  return (
    <div className="agent-flow-wrap">
      <div className={`agent-flow ${hasActivity ? "has-activity" : "idle-only"}`}>
        {stages.map((stage, i) => (
          <div className="flow-stage-group" key={stage.name}>
            <button
              type="button"
              className={`flow-stage state-${stage.state} ${
                selected === stage.name ? "selected" : ""
              }`}
              onClick={() =>
                setSelected(selected === stage.name ? null : stage.name)
              }
              aria-pressed={selected === stage.name}
              aria-label={`${stage.name} agent — ${STATE_LABEL[stage.state]}`}
            >
              <span className="flow-number">
                {String(stage.number).padStart(2, "0")}
              </span>
              <div className="flow-node-row">
                <div className="flow-node">
                  <Icon name={stage.icon} fill={stage.state === "complete"} />
                  {stage.event && <span className="node-dot" />}
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={`flow-line ${
                      stage.state === "error" ||
                      stages[i + 1].state === "error"
                        ? "line-error"
                        : stage.event || stages[i + 1].event
                        ? "active"
                        : ""
                    }`}
                  >
                    <i style={{ animationDelay: `${i * 0.3}s` }} />
                  </div>
                )}
              </div>
              <span className="flow-name">{stage.name.toUpperCase()}</span>
              <span className="flow-status-label">
                {STATE_LABEL[stage.state]}
              </span>
            </button>
          </div>
        ))}
      </div>

      <div className="agent-detail">
        {selectedStage ? (
          <>
            <div className="agent-detail-head">
              <div>
                <span className="eyebrow">AGENT ACTIVITY</span>
                <h4>{selectedStage.name} Agent</h4>
              </div>
              <CloseButton onClose={() => setSelected(null)} />
            </div>
            <p className="agent-role-text">{selectedStage.role}</p>

            {selectedStage.state === "human-review" && (
              <div className="human-review-banner">
                <span>AI RECOMMENDATION</span>
                <Icon name="arrow_forward" />
                <span>HUMAN REVIEW — APPROVAL REQUIRED</span>
              </div>
            )}

            {selectedStage.event ? (
              <dl className="agent-detail-grid">
                <div>
                  <dt>STATUS</dt>
                  <dd>{selectedStage.event.status}</dd>
                </div>
                <div>
                  <dt>MODE</dt>
                  <dd>{selectedStage.event.mode || "—"}</dd>
                </div>
                {selectedStage.event.incident_id && (
                  <div>
                    <dt>INCIDENT</dt>
                    <dd>{selectedStage.event.incident_id}</dd>
                  </div>
                )}
                <div>
                  <dt>TIMESTAMP</dt>
                  <dd>{formatTime(selectedStage.event.timestamp)}</dd>
                </div>
                {selectedStage.event.output_summary && (
                  <div className="span-2">
                    <dt>ACTION</dt>
                    <dd>{selectedStage.event.output_summary}</dd>
                  </div>
                )}
                {selectedStage.event.error && (
                  <div className="span-2">
                    <dt>ERROR</dt>
                    <dd className="text-error">{selectedStage.event.error}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="agent-no-event">No agent execution selected.</p>
            )}
          </>
        ) : (
          <p className="agent-no-event">
            Select an agent above to view its latest activity.
          </p>
        )}
      </div>
    </div>
  );
}

/** Deterministic ambient geometry for the empty state — explicitly
 * non-semantic (no labels, no severity, no IDs). These do not represent
 * real signals; they exist only to communicate "a live intelligence
 * system, currently idle" per design brief. Fixed coordinates (not
 * random) so the render is stable across re-renders and testable. */
const AMBIENT_NODES = [
  { x: 70, y: 55 },
  { x: 158, y: 32 },
  { x: 250, y: 46 },
  { x: 320, y: 92 },
  { x: 262, y: 156 },
  { x: 142, y: 166 },
  { x: 68, y: 128 },
];
const AMBIENT_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 6],
];

function GeospatialFrame() {
  // Purely decorative technical framing — no fabricated coordinates,
  // no invented lat/long values. Communicates "intelligence console"
  // styling without pretending any of it is real geographic data.
  return (
    <>
      <g className="geo-corners" stroke="rgba(69,214,232,0.35)" strokeWidth="1" fill="none">
        <path d="M10,22 V10 H22" />
        <path d="M368,10 H380 V22" />
        <path d="M380,188 V200 H368" />
        <path d="M22,200 H10 V188" />
      </g>
      <g className="geo-ticks" stroke="rgba(145,165,184,0.25)" strokeWidth="1">
        {[60, 130, 200, 270, 340].map((x) => (
          <line key={`vx-${x}`} x1={x} y1="0" x2={x} y2="6" />
        ))}
        {[40, 80, 120, 160].map((y) => (
          <line key={`hy-${y}`} x1="0" y1={y} x2="6" y2={y} />
        ))}
      </g>
    </>
  );
}

function GeospatialBadge() {
  return (
    <div className="geo-badge">
      <span className="eyebrow">GEOSPATIAL CONTEXT</span>
      <span>Awaiting geospatial coordinates</span>
    </div>
  );
}

function SignalFusionAmbient() {
  return (
    <svg
      className="fusion-svg fusion-ambient"
      viewBox="0 0 390 210"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fusionScan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--cyan)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="radarWedge" cx="0" cy="0" r="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <GeospatialFrame />

      <g className="ambient-edges">
        {AMBIENT_EDGES.map(([a, b], i) => {
          const p1 = AMBIENT_NODES[a];
          const p2 = AMBIENT_NODES[b];
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        })}
      </g>

      <g className="ambient-nodes">
        {AMBIENT_NODES.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.6"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
        ))}
      </g>

      <g transform="translate(195,105)">
        <g className="radar-sweep-group">
          <path
            className="radar-wedge"
            d="M0,0 L120,0 A120,120 0 0,0 84.8,-84.8 Z"
            fill="url(#radarWedge)"
          />
        </g>
      </g>

      <g className="center-pulse" transform="translate(195,105)">
        <circle className="pulse-ring ring-a" r="9" />
        <circle className="pulse-ring ring-b" r="9" />
        <circle className="pulse-core" r="3" />
      </g>

      <rect className="fusion-sweep" x="-70" y="0" width="70" height="210" fill="url(#fusionScan)" />
    </svg>
  );
}

function SignalFusionActive({ shown, selectedIncident }) {
  const [hoverId, setHoverId] = useState(null);
  const cx = 195;
  const cy = 105;
  const radius = 72;

  const nodes = shown.map((s, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...s,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * 0.72 * Math.sin(angle),
    };
  });

  const hovered = nodes.find((n) => n.id === hoverId);

  return (
    <div className="fusion-active">
      <svg
        className="fusion-svg"
        viewBox="0 0 390 210"
        preserveAspectRatio="xMidYMid meet"
      >
        <GeospatialFrame />

        {selectedIncident && (
          <g className="fusion-edges">
            {nodes.map((n) => (
              <line
                key={`edge-${n.id}`}
                x1={n.x}
                y1={n.y}
                x2={cx}
                y2={cy}
                className={hoverId && hoverId !== n.id ? "dim" : ""}
              />
            ))}
          </g>
        )}

        {selectedIncident && (
          <g
            className={`incident-node-svg sev-${selectedIncident.severity || "unknown"}`}
            transform={`translate(${cx},${cy})`}
          >
            <circle className="incident-ring-outer" r="20" />
            <circle className="incident-core" r="7" />
          </g>
        )}

        {nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            className={[
              "signal-node-svg",
              `sev-${n.severity || "unknown"}`,
              hoverId === n.id ? "hovered glow" : "",
              hoverId && hoverId !== n.id ? "dim" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId(null)}
            onFocus={() => setHoverId(n.id)}
            onBlur={() => setHoverId(null)}
            tabIndex={0}
            role="button"
            aria-label={`Signal ${n.id}${n.severity ? `, severity ${n.severity}` : ""}`}
          >
            <circle className="node-outer" r="11" />
            <circle className="node-core" r="4.5" />
          </g>
        ))}
      </svg>

      {selectedIncident && (
        <div className="fusion-incident-label">
          <strong>{selectedIncident.id}</strong>
          <small>{selectedIncident.title}</small>
        </div>
      )}

      {hovered && (
        <div
          className="fusion-tooltip"
          style={{
            left: `${(hovered.x / 390) * 100}%`,
            top: `${(hovered.y / 210) * 100}%`,
          }}
        >
          <strong>SIGNAL {hovered.id}</strong>
          <span>Source: {hovered.source || "Unknown"}</span>
          {hovered.location && <span>Location: {hovered.location}</span>}
          {hovered.severity && <span>Severity: {hovered.severity}</span>}
          {hovered.timestamp && (
            <span>Received: {formatTime(hovered.timestamp)}</span>
          )}
        </div>
      )}
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

  const hasData = shown.length > 0;

  return (
    <div className="correlation-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">LIVE CORRELATION</span>
          <h3>Signal Fusion</h3>
        </div>
        <Badge tone={hasData ? "ai" : "neutral"}>
          {hasData ? "REAL RELATIONSHIPS" : "NO CORRELATIONS"}
        </Badge>
      </div>

      <div className="graph-canvas">
        {hasData ? (
          <SignalFusionActive shown={shown} selectedIncident={selectedIncident} />
        ) : (
          <>
            <SignalFusionAmbient />
            <div className="graph-empty">
              <Icon name="hub" />
              <span>No correlated signals yet.</span>
              <small>Submit related signals to create an incident.</small>
            </div>
          </>
        )}
        <GeospatialBadge />
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
  onClose,
  busy,
  authorityExceeded,
  maxApprovableRisk,
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
  const isDemo = linked.some((s) => s.metadata?.demo_scenario);

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
          {isDemo && (
            <Badge tone="ai">
              DEMO SCENARIO • SYNTHETIC INPUT
            </Badge>
          )}
        </div>
        <div className="assessment-head-actions">
          <Badge tone={tone}>
            {(incident.severity || "unclassified").toUpperCase()}
          </Badge>
          <CloseButton onClose={onClose} />
        </div>
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
              {authorityExceeded
                ? "Approval authority exceeded (local operator policy)."
                : "SYNTRA proposes; an operator decides."}
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
              disabled={busy || authorityExceeded}
              onClick={onApprove}
              type="button"
              title={
                authorityExceeded
                  ? `This incident's risk score exceeds your configured approval authority (max ${maxApprovableRisk}/100).`
                  : undefined
              }
            >
              <Icon name="verified" />{" "}
              {busy
                ? "PROCESSING"
                : authorityExceeded
                ? "AUTHORITY EXCEEDED"
                : "APPROVE RESPONSE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoScenarioButton({ onResult }) {
  const [status, setStatus] = useState("idle"); // idle | running | done
  const [error, setError] = useState("");

  const run = async () => {
    setStatus("running");
    setError("");

    try {
      const result = await runElectricalFireDemo();
      await onResult(result);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  return (
    <div className="demo-scenario-control">
      <button
        className="button demo"
        type="button"
        onClick={run}
        disabled={status === "running"}
      >
        <Icon name={status === "running" ? "hourglass_top" : "local_fire_department"} />
        {status === "running" ? "RUNNING SCENARIO…" : "RUN DEMO SCENARIO"}
      </button>
      {error && <small className="demo-scenario-error">{error}</small>}
    </div>
  );
}

function CommandCenter({ data, refresh, maxApprovableRisk }) {
  const { health, signals, incidents, agents, events } = data;
  const [selectedId, setSelectedId] = useState(
    incidents[0]?.id || null
  );
  const [selected, setSelected] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const hasAutoSelected = useRef(Boolean(incidents[0]?.id));

  const handleDemoResult = async (result) => {
    await refresh();
    if (result?.incident_id) {
      setSelectedId(result.incident_id);
      hasAutoSelected.current = true;
    }
  };

  const closeDetail = useCallback(() => {
    setSelectedId(null);
  }, []);
  useEscapeToClose(Boolean(selectedId), closeDetail);

  useEffect(() => {
    if (!hasAutoSelected.current && !selectedId && incidents[0]) {
      setSelectedId(incidents[0].id);
      hasAutoSelected.current = true;
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

  const riskScore100 =
    selected?.confidence != null
      ? Math.round(selected.confidence * 100)
      : null;
  const authorityExceeded =
    riskScore100 != null &&
    maxApprovableRisk != null &&
    riskScore100 > maxApprovableRisk;

  const approve = async () => {
    if (!selected || authorityExceeded) return;

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
          <>
            <DemoScenarioButton onResult={handleDemoResult} />
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
          </>
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
          onClose={closeDetail}
          busy={busy}
          authorityExceeded={authorityExceeded}
          maxApprovableRisk={maxApprovableRisk}
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
          agents={agents}
          incidents={incidents}
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
          <Dropdown
            ariaLabel="Severity"
            value={form.severity}
            onChange={(v) => setForm({ ...form, severity: v })}
            options={[
              { value: "", label: "Auto / unknown" },
              ...Object.keys(SEVERITY).map((s) => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
                tone: SEVERITY[s].cls,
              })),
            ]}
          />
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

function SignalsPage({ data, refresh, focusId }) {
  const [selectedId, setSelectedId] = useState(
    focusId || data.signals[0]?.id || null
  );
  const [query, setQuery] = useState("");
  const hasAutoSelected = useRef(Boolean(focusId || data.signals[0]?.id));

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

  const closeDetail = useCallback(() => {
    setSelectedId(null);
  }, []);
  useEscapeToClose(Boolean(selectedId), closeDetail);

  useEffect(() => {
    if (!hasAutoSelected.current && !selectedId && data.signals[0]) {
      setSelectedId(data.signals[0].id);
      hasAutoSelected.current = true;
    }
  }, [data.signals, selectedId]);

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      setQuery("");
      hasAutoSelected.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

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

        <SignalDetail signal={selected} onClose={closeDetail} />
      </div>
    </div>
  );
}

function SignalDetail({ signal, onClose }) {
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

        <div className="detail-head-actions">
          <Badge tone={severityTone(signal.severity)}>
            {signal.status}
          </Badge>
          <CloseButton onClose={onClose} />
        </div>
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

function IncidentsPage({ data, refresh, focusId, maxApprovableRisk }) {
  const [selectedId, setSelectedId] = useState(
    focusId || data.incidents[0]?.id || null
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [busy, setBusy] = useState(false);
  const hasAutoSelected = useRef(Boolean(focusId || data.incidents[0]?.id));

  const filtered = data.incidents.filter((i) =>
    `${i.id} ${i.title} ${i.location || ""} ${
      i.status
    }`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const closeDetail = useCallback(() => {
    setSelectedId(null);
  }, []);
  useEscapeToClose(Boolean(selectedId), closeDetail);

  useEffect(() => {
    if (!hasAutoSelected.current && !selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
      hasAutoSelected.current = true;
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      setQuery("");
      hasAutoSelected.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

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

  const riskScore100 =
    selected?.confidence != null
      ? Math.round(selected.confidence * 100)
      : null;
  const authorityExceeded =
    riskScore100 != null &&
    maxApprovableRisk != null &&
    riskScore100 > maxApprovableRisk;

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
          signals={data.signals}
          events={events}
          timeline={timeline}
          busy={busy}
          onApprove={() => {
            if (!authorityExceeded) act(approveIncident);
          }}
          onReject={() => act(rejectIncident)}
          onClose={closeDetail}
          authorityExceeded={authorityExceeded}
          maxApprovableRisk={maxApprovableRisk}
        />
      </div>
    </div>
  );
}

function IncidentDetail({
  incident,
  signals,
  events,
  timeline,
  busy,
  onApprove,
  onReject,
  onClose,
  authorityExceeded,
  maxApprovableRisk,
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

  const isDemo = (signals || []).some(
    (s) =>
      incident.signal_ids?.includes(s.id) &&
      s.metadata?.demo_scenario
  );

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
          {isDemo && (
            <Badge tone="ai">
              DEMO SCENARIO • SYNTHETIC INPUT
            </Badge>
          )}
        </div>

        <div className="detail-head-actions">
          <Badge
            tone={severityTone(incident.severity)}
          >
            {incident.status}
          </Badge>
          <CloseButton onClose={onClose} />
        </div>
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
              {authorityExceeded
                ? "Approval authority exceeded (local operator policy)."
                : "Approval is recorded in the audit trail."}
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
              disabled={busy || authorityExceeded}
              onClick={onApprove}
              type="button"
              title={
                authorityExceeded
                  ? `This incident's risk score exceeds your configured approval authority (max ${maxApprovableRisk}/100).`
                  : undefined
              }
            >
              {busy
                ? "PROCESSING"
                : authorityExceeded
                ? "AUTHORITY EXCEEDED"
                : "APPROVE RESPONSE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SYSTEM_BOOT_LINES = [
  { hex: "0x7a3f", text: "INIT agent_pipeline()" },
  { hex: "0x9c2d", text: "Loading orchestration layer…" },
  { hex: "0x4b6e", text: "Establishing service connection…" },
  { hex: "0x1f8a", text: "Listening for agent events…" },
  { hex: "0x3d5c", text: "System ready. Awaiting operational data…" },
];

/**
 * Cosmetic-only terminal shown when there are zero real agent events. This
 * is UI dressing so the panel doesn't look broken/empty — nothing here is
 * written to the backend, SQLite, agent_events, incidents, or signals.
 * The moment a real event exists, this component is not rendered at all;
 * the actual event stream takes over.
 */
function SystemStatusTerminal() {
  const bootTime = useMemo(() => new Date(), []);

  return (
    <div className="system-status-terminal">
      <div className="system-status-head">
        <span className="eyebrow">SYSTEM STATUS</span>
        <span>NO RECORDED AGENT EVENTS</span>
      </div>

      <div className="terminal-body">
        {SYSTEM_BOOT_LINES.map((line, i) => (
          <div
            className="terminal-line"
            key={line.hex}
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <span className="terminal-time">
              [{formatTime(new Date(bootTime.getTime() + i * 900).toISOString())}]
            </span>{" "}
            <span className="terminal-hex">{line.hex}…</span>{" "}
            <span className="terminal-sep">::</span> {line.text}
          </div>
        ))}
        <div
          className="terminal-cursor"
          style={{ animationDelay: `${SYSTEM_BOOT_LINES.length * 0.35}s` }}
        >
          <span className="terminal-time">
            [{formatTime(new Date(bootTime.getTime() + SYSTEM_BOOT_LINES.length * 900).toISOString())}]
          </span>{" "}
          <i className="cursor-blink">▍</i>
        </div>
      </div>

      <small className="terminal-disclaimer">
        Cosmetic system status — not an operational record. Real agent
        events appear here automatically once signals are processed.
      </small>
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
        <AgentFlow events={events} agents={data.agents} incidents={data.incidents} />
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
          <SystemStatusTerminal />
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
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

function SettingsModal({ health, prefs, updatePrefs, onClose }) {
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
            <strong>Auto refresh</strong>
            <span>
              Automatically poll the API for updates.
            </span>
          </div>
          <label className="pref-toggle">
            <input
              type="checkbox"
              checked={prefs.autoRefresh}
              onChange={(e) =>
                updatePrefs({ autoRefresh: e.target.checked })
              }
            />
            <span>{prefs.autoRefresh ? "ON" : "OFF"}</span>
          </label>
        </div>

        <div className="setting-row">
          <div>
            <strong>Refresh interval</strong>
            <span>
              How often the interface checks the API for
              updates, when auto refresh is on.
            </span>
          </div>
          <select
            className="pref-select"
            value={prefs.refreshInterval}
            disabled={!prefs.autoRefresh}
            onChange={(e) =>
              updatePrefs({ refreshInterval: Number(e.target.value) })
            }
          >
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Interface density</strong>
            <span>
              Compact reduces spacing for higher information
              density.
            </span>
          </div>
          <select
            className="pref-select"
            value={prefs.density}
            onChange={(e) => updatePrefs({ density: e.target.value })}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Reduced motion</strong>
            <span>
              Minimizes animation, independent of your
              operating system setting.
            </span>
          </div>
          <label className="pref-toggle">
            <input
              type="checkbox"
              checked={prefs.reducedMotion}
              onChange={(e) =>
                updatePrefs({ reducedMotion: e.target.checked })
              }
            />
            <span>{prefs.reducedMotion ? "ON" : "OFF"}</span>
          </label>
        </div>
      </div>
      <div className="modal-note">
        <Icon name="info" />
        <span>
          These preferences are saved in this browser only and do not
          change backend behavior.
        </span>
      </div>
    </Modal>
  );
}

/**
 * Local development operator identity + preferences. Notification and
 * approval-authority settings persist via the same localStorage-backed
 * usePreferences() hook as System Settings. Audit history is fetched live
 * from the real /api/audit/approvals endpoint (backed by the existing
 * approvals table) — never fabricated. Clear Data calls the real backend
 * reset endpoint; nothing here just clears local React state.
 */
function OperatorPanel({ prefs, updatePrefs, onClose, refresh }) {
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [resetConfigured, setResetConfigured] = useState(null); // null = checking
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listAuditApprovals(10);
        if (!cancelled) setAudit(rows);
      } catch {
        if (!cancelled) setAudit([]);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    (async () => {
      try {
        const status = await getAdminResetStatus();
        if (!cancelled) setResetConfigured(Boolean(status?.configured));
      } catch {
        // Can't reach the status check — treat as unknown/unconfigured
        // rather than silently pretending it works.
        if (!cancelled) setResetConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openConfirm = () => {
    setResetError("");
    setResetSuccess(false);
    setConfirmingReset(true);
  };

  const cancelConfirm = () => {
    setConfirmingReset(false);
    setResetToken("");
    setResetError("");
    setResetSuccess(false);
  };

  const handleReset = async () => {
    setResetBusy(true);
    setResetError("");
    try {
      await resetAllData(resetToken);
      await refresh();
      setAudit([]);
      setResetToken("");
      setResetSuccess(true);
    } catch (e) {
      if (e.status === 403) {
        setResetConfigured(false);
        setResetError(
          "The administrator reset token (SYNTRA_ADMIN_RESET_TOKEN) is " +
            "not configured on the backend. Clear Data cannot run until " +
            "an administrator sets that environment variable on the " +
            "server."
        );
      } else if (e.status === 401) {
        setResetError(
          "That admin reset token was rejected. Check the value and try again."
        );
      } else {
        setResetError(`Reset failed: ${e.message}`);
      }
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <Modal title="Operator" icon="account_circle" onClose={onClose}>
      <section className="operator-section">
        <h3>User Identity</h3>
        <div className="operator-identity">
          <div>
            <span>Name</span>
            <strong>SYNTRA Operator</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>operator@syntra.local</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>Operations Supervisor</strong>
          </div>
        </div>
        <div className="modal-note">
          <Icon name="info" />
          <span>
            Local development operator — not backed by real
            authentication.
          </span>
        </div>
      </section>

      <section className="operator-section">
        <h3>Notification Preferences</h3>
        <div className="setting-row">
          <div>
            <strong>Email notifications</strong>
            <span>
              Email delivery is not configured in this environment.
            </span>
          </div>
          <label className="pref-toggle">
            <input
              type="checkbox"
              checked={prefs.emailNotifications}
              onChange={(e) =>
                updatePrefs({ emailNotifications: e.target.checked })
              }
            />
            <span>{prefs.emailNotifications ? "ON" : "OFF"}</span>
          </label>
        </div>
        <div className="setting-row">
          <div>
            <strong>In-app notifications</strong>
            <span>
              Controls whether SYNTRA surfaces operational alerts in
              the notification bell.
            </span>
          </div>
          <label className="pref-toggle">
            <input
              type="checkbox"
              checked={prefs.inAppNotifications}
              onChange={(e) =>
                updatePrefs({ inAppNotifications: e.target.checked })
              }
            />
            <span>{prefs.inAppNotifications ? "ON" : "OFF"}</span>
          </label>
        </div>
      </section>

      <section className="operator-section">
        <h3>Approval Authority</h3>
        <div className="setting-row">
          <div>
            <strong>Maximum risk score approvable</strong>
            <span>
              Operator may approve incidents up to this risk score.
              Incidents above it require a higher authority to approve.
            </span>
          </div>
          <div className="risk-threshold">
            <input
              type="number"
              min={0}
              max={100}
              className="risk-threshold-input"
              value={prefs.maxApprovableRisk}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const clamped = Math.max(
                  0,
                  Math.min(100, Number.isNaN(raw) ? 0 : raw)
                );
                updatePrefs({ maxApprovableRisk: clamped });
              }}
              aria-label="Maximum risk score approvable"
            />
            <span>/ 100</span>
          </div>
        </div>
        <div className="modal-note">
          <Icon name="info" />
          <span>
            This is a local operator-policy setting for this development
            environment, saved in this browser only. It is enforced in
            the UI, not by the backend — there is no server-side
            authorization to back it, since no operator/authentication
            system exists yet.
          </span>
        </div>
      </section>

      <section className="operator-section">
        <h3>Audit History</h3>
        {auditLoading ? (
          <LoadingState label="Loading audit history" />
        ) : audit.length === 0 ? (
          <p className="agent-no-event">No approval history recorded.</p>
        ) : (
          <ul className="audit-list">
            {audit.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.incident_id}</strong>
                  <Badge tone={a.status === "approved" ? "ai" : "critical"}>
                    {(a.status || "").toUpperCase()}
                  </Badge>
                </div>
                <span>
                  {formatTime(a.timestamp)} ·{" "}
                  {a.approved_by || "unknown operator"}
                  {a.incident_confidence != null &&
                    ` · risk ${Math.round(a.incident_confidence * 100)}/100`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="operator-section">
        <h3>Password Change</h3>
        <div className="setting-row">
          <div>
            <strong>Change password</strong>
            <span>
              Password management is unavailable because authentication
              is not configured.
            </span>
          </div>
          <button className="button" type="button" disabled>
            <Icon name="lock" /> UNAVAILABLE
          </button>
        </div>
      </section>

      <section className="operator-section">
        <h3>System Controls</h3>

        <div className="reset-status-line">
          <span
            className={`reset-status-dot ${
              resetConfigured === null
                ? "checking"
                : resetConfigured
                ? "on"
                : "off"
            }`}
          />
          <span>
            {resetConfigured === null
              ? "Checking whether Clear Data is configured on this server…"
              : resetConfigured
              ? "Clear Data is configured on this server."
              : "Clear Data is NOT configured on this server (SYNTRA_ADMIN_RESET_TOKEN is unset)."}
          </span>
        </div>

        {!confirmingReset ? (
          <div className="setting-row">
            <div>
              <strong>Clear Data</strong>
              <span>
                Permanently deletes persisted signals, incidents, agent
                events, and approval/audit records in this environment.
              </span>
            </div>
            <button
              className="button reject"
              type="button"
              onClick={openConfirm}
              disabled={resetConfigured === null}
            >
              <Icon name="delete" /> CLEAR DATA
            </button>
          </div>
        ) : (
          <div className="reset-confirm">
            <p>This will permanently delete:</p>
            <ul className="plain-list">
              <li>All persisted signals</li>
              <li>All incidents</li>
              <li>All agent events</li>
              <li>All approval / audit records</li>
            </ul>

            {resetSuccess ? (
              <div className="reset-success">
                <Icon name="verified" /> Data cleared successfully. The
                dashboard has been refreshed to its empty state.
              </div>
            ) : resetConfigured === false ? (
              <p className="reset-error">
                The administrator reset token
                (<code>SYNTRA_ADMIN_RESET_TOKEN</code>) is not configured
                on the backend. Clear Data is unavailable until an
                administrator sets that environment variable on the
                server — there is nothing you can enter here to work
                around this.
              </p>
            ) : (
              <>
                <label className="reset-token-field">
                  <span>Admin reset token</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Required to authorize this reset"
                  />
                </label>
                <small className="modal-note-inline">
                  This token is entered here only — it is never stored in
                  the app's code or bundled into the frontend build. The
                  backend rejects the reset if it's missing or incorrect.
                </small>
                {resetError && (
                  <p className="reset-error">{resetError}</p>
                )}
              </>
            )}

            <div className="approval-actions">
              <button
                className="button"
                type="button"
                onClick={cancelConfirm}
                disabled={resetBusy}
              >
                {resetSuccess ? "CLOSE" : "CANCEL"}
              </button>
              {!resetSuccess && resetConfigured !== false && (
                <button
                  className="button reject"
                  type="button"
                  onClick={handleReset}
                  disabled={resetBusy || !resetToken}
                >
                  {resetBusy ? "CLEARING…" : "CONFIRM CLEAR DATA"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
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
  const [allFailed, setAllFailed] = useState(false);
  const [prefs, updatePrefs] = usePreferences();
  const [modal, setModal] = useState(null);
  const [focusSignalId, setFocusSignalId] = useState(null);
  const [focusIncidentId, setFocusIncidentId] = useState(null);

  const navigate = (page) => {
    setActive(page);
    window.location.hash = page;
  };

  const jumpToSignal = (id) => {
    setFocusSignalId(id);
    navigate("signals");
  };

  const jumpToIncident = (id) => {
    setFocusIncidentId(id);
    navigate("incidents");
  };

  const notifications = useMemo(
    () => (prefs.inAppNotifications ? computeNotifications(data) : []),
    [data, prefs.inAppNotifications]
  );

  const refresh = useCallback(async () => {
    const endpoints = [
      ["health", getHealth],
      ["signals", listSignals],
      ["incidents", listIncidents],
      ["agents", listAgents],
      ["events", listAgentEvents],
    ];

    const results = await Promise.allSettled(
      endpoints.map(([, fn]) => fn())
    );

    const failures = [];
    setData((prev) => {
      const next = { ...prev };
      results.forEach((result, i) => {
        const [key] = endpoints[i];
        if (result.status === "fulfilled") {
          next[key] = result.value;
        } else {
          failures.push(
            `${key.toUpperCase()} — ${result.reason?.message || "request failed"}`
          );
        }
      });
      return next;
    });

    setError(failures.length ? failures.join("  ·  ") : "");
    setAllFailed(failures.length === endpoints.length);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    if (!prefs.autoRefresh) return undefined;

    const timer = setInterval(refresh, prefs.refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refresh, prefs.autoRefresh, prefs.refreshInterval]);

  useEffect(() => {
    const hash = () =>
      setActive(
        window.location.hash.replace("#", "") ||
          "command"
      );

    window.addEventListener("hashchange", hash);

    return () => {
      window.removeEventListener("hashchange", hash);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "density-compact",
      prefs.density === "compact"
    );
    document.documentElement.classList.toggle(
      "force-reduced-motion",
      prefs.reducedMotion
    );
  }, [prefs.density, prefs.reducedMotion]);

  const page =
    active === "incidents" ? (
      <IncidentsPage
        data={data}
        refresh={refresh}
        focusId={focusIncidentId}
        maxApprovableRisk={prefs.maxApprovableRisk}
      />
    ) : active === "signals" ? (
      <SignalsPage data={data} refresh={refresh} focusId={focusSignalId} />
    ) : active === "agents" ? (
      <AgentsPage data={data} />
    ) : active === "analytics" ? (
      <AnalyticsPage data={data} />
    ) : active === "history" ? (
      <HistoryPage data={data} />
    ) : (
      <CommandCenter
        data={data}
        refresh={refresh}
        maxApprovableRisk={prefs.maxApprovableRisk}
      />
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
          signals={data.signals}
          incidents={data.incidents}
          notifications={notifications}
          onJumpToSignal={jumpToSignal}
          onJumpToIncident={jumpToIncident}
          onOperator={() => setModal("operator")}
        />

        <main className="content">
          {error && (
            <div className="global-error">
              <Icon name="cloud_off" />
              <span>
                {allFailed ? "Backend unavailable" : "Some data unavailable"}: {error}
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
          prefs={prefs}
          updatePrefs={updatePrefs}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "operator" && (
        <OperatorPanel
          prefs={prefs}
          updatePrefs={updatePrefs}
          onClose={() => setModal(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

export default App;
