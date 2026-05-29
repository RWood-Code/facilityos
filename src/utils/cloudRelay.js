const STORAGE_RELAY = 'facilityos_cloud_relay_url';
const STORAGE_SITE = 'facilityos_cloud_site_id';
const STORAGE_SESSION = 'facilityos_cloud_session';

export function getCloudRelayUrl() {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_RELAY);
  if (stored) return stored.replace(/\/$/, '');
  if (import.meta.env.VITE_CLOUD_RELAY_URL) {
    return String(import.meta.env.VITE_CLOUD_RELAY_URL).replace(/\/$/, '');
  }
  return null;
}

export function setCloudRelayUrl(url) {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem(STORAGE_RELAY, url.replace(/\/$/, ''));
  else localStorage.removeItem(STORAGE_RELAY);
}

export function getCloudSiteId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_SITE) || import.meta.env.VITE_CLOUD_SITE_ID || null;
}

export function setCloudSiteId(siteId) {
  if (typeof window === 'undefined') return;
  if (siteId) localStorage.setItem(STORAGE_SITE, siteId);
  else localStorage.removeItem(STORAGE_SITE);
}

export function getCloudSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCloudSession(session) {
  if (typeof window === 'undefined') return;
  if (session) localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_SESSION);
}

export function clearCloudSession() {
  setCloudSession(null);
}

export function isCloudClientMode() {
  return !import.meta.env.SSR && !!(getCloudRelayUrl() && getCloudSiteId());
}

export function cloudAuthHeaders(extra = {}) {
  const session = getCloudSession();
  const headers = { ...extra };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

async function relayFetch(path, { method = 'GET', body } = {}) {
  const base = getCloudRelayUrl();
  if (!base) throw new Error('cloud_relay_not_configured');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: cloudAuthHeaders({ 'Content-Type': 'application/json' }),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Relay HTTP ${res.status}`);
  return data;
}

export async function cloudLogin({ siteId, email, password }) {
  const base = getCloudRelayUrl();
  if (!base) throw new Error('cloud_relay_not_configured');
  const res = await fetch(`${base}/api/sites/${siteId}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'login_failed');
  setCloudSiteId(siteId);
  setCloudSession({ token: data.data.token, user: data.data.user, site: data.data.site });
  return data.data;
}

export async function fetchCloudManagerDashboard() {
  const siteId = getCloudSiteId();
  if (!siteId) throw new Error('cloud_site_required');
  const data = await relayFetch(`/api/sites/${siteId}/manager-dashboard`);
  return data.data;
}

export async function subscribeCloudPush(subscription) {
  const siteId = getCloudSiteId();
  if (!siteId) throw new Error('cloud_site_required');
  return relayFetch(`/api/sites/${siteId}/push/subscribe`, {
    method: 'POST',
    body: { subscription },
  });
}

export async function fetchVapidPublicKey() {
  const base = getCloudRelayUrl();
  if (!base) return null;
  const res = await fetch(`${base}/api/push/vapid-public-key`);
  const data = await res.json().catch(() => ({}));
  return data.publicKey || null;
}

export async function checkCloudRelayHealth() {
  const base = getCloudRelayUrl();
  if (!base) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${base}/api/health`);
    return res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Decode VAPID public key for PushManager.subscribe */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}
