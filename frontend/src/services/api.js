const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health API error (${res.status})`);
  return res.json();
}

export async function fetchSystem() {
  const res = await fetch(`${API_BASE}/system`);
  if (!res.ok) throw new Error(`System API error (${res.status})`);
  return res.json();
}

export async function fetchProcesses({ search = '', sort = 'cpu', order = 'desc', risk = 'ALL', page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams({
    search,
    sort,
    order,
    risk,
    page: page.toString(),
    limit: limit.toString(),
  });
  const res = await fetch(`${API_BASE}/processes?${params.toString()}`);
  if (!res.ok) throw new Error(`Processes API error (${res.status})`);
  return res.json();
}

export async function fetchTopProcesses(k = 5) {
  const res = await fetch(`${API_BASE}/processes/top?k=${k}`);
  if (!res.ok) throw new Error(`Top processes API error (${res.status})`);
  return res.json();
}

export async function fetchAlerts(severity = null) {
  const url = severity ? `${API_BASE}/alerts?severity=${severity}` : `${API_BASE}/alerts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alerts API error (${res.status})`);
  return res.json();
}

export async function fetchHistory(limit = 30) {
  const res = await fetch(`${API_BASE}/history?limit=${limit}`);
  if (!res.ok) throw new Error(`History API error (${res.status})`);
  return res.json();
}

export async function triggerSample() {
  const res = await fetch(`${API_BASE}/monitor`, { method: 'POST' });
  if (!res.ok) throw new Error(`Trigger monitor failed (${res.status})`);
  return res.json();
}
