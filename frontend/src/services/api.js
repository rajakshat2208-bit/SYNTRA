const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function req(path, options) {
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
export const listAgents = () => req("/agents");
export const listAgentEvents = (incidentId) =>
  req(incidentId ? `/agent-events?incident_id=${incidentId}` : "/agent-events");
