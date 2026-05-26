const API = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  meta: () => request('/meta'),
  planModules: (plan) => request(`/plan-modules?plan=${encodeURIComponent(plan)}`),
  generate: (body) => request('/generate', { method: 'POST', body: JSON.stringify(body) }),
  issued: () => request('/issued'),
  removeIssued: (id) => request(`/issued/${id}`, { method: 'DELETE' }),
};

export function copyText(text) {
  return navigator.clipboard?.writeText(text);
}

export function defaultExpiry() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
