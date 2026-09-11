/**
 * Centralized API base URL handling. Every request in this app goes through
 * req() below — no component or page constructs a URL independently.
 */
function normalizeApiBaseUrl(rawUrl, isProd) {
  if (!rawUrl) {
    if (isProd) {
      throw new Error(
        "VITE_API_URL is not configured for this build. Set it in your " +
          "deployment environment to your backend's URL, e.g. " +
          "https://your-backend.onrender.com/api, then rebuild."
      );
    }
    return "http://localhost:8000/api";
  }

  let base = rawUrl.trim().replace(/\/+$/, ""); // strip trailing slash(es)
  base = base.replace(/\/api\/api$/, "/api"); // collapse an accidental double /api
  if (!/\/api$/.test(base)) base += "/api"; // ensure exactly one /api suffix

  return base;
}

let BASE;
let CONFIG_ERROR = null;
try {
  BASE = normalizeApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);
} catch (e) {
  // Fail loudly rather than silently pointing at a dead localhost URL in
  // production — every request will surface this same clear message
  // instead of a confusing generic network error.
  CONFIG_ERROR = e.message;
  console.error("[SYNTRA config error]", e.message);
}

async function req(path, options) {
  if (CONFIG_ERROR) {
    throw new Error(CONFIG_ERROR);
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const getHealth = () => req("/health");
export const listSignals = () => req("/signals");
export const createSignal = (data) => req("/signals", { method: "POST", body: JSON.stringify(data) });
export const listIncidents = () => req("/incidents");
export const getIncident = (id) => req(`/incidents/${id}`);
export const getIncidentTimeline = (id) => req(`/incidents/${id}/timeline`);
export const approveIncident = (id, approvedBy) =>
  req(`/incidents/${id}/approve`, { method: "POST", body: JSON.stringify({ approved_by: approvedBy }) });
export const rejectIncident = (id, approvedBy) =>
  req(`/incidents/${id}/reject`, { method: "POST", body: JSON.stringify({ approved_by: approvedBy }) });
export const runElectricalFireDemo = () =>
  req("/demo/electrical-fire", { method: "POST" });
export const listAgents = () => req("/agents");
export const listAgentEvents = (incidentId) =>
  req(incidentId ? `/agent-events?incident_id=${incidentId}` : "/agent-events");

export const __normalizeApiBaseUrl = normalizeApiBaseUrl;
