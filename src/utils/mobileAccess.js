const STORAGE_SERVER = 'facilityos_server_url';
const STORAGE_TERMINAL = 'facilityos_terminal';
const STORAGE_TOKEN = 'facilityos_access_token';

export const isElectron = typeof window !== 'undefined' && typeof window.db !== 'undefined';

export function getStoredServerUrl() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_SERVER)?.replace(/\/$/, '') || null;
}

export function setStoredServerUrl(url) {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem(STORAGE_SERVER, url.replace(/\/$/, ''));
  else localStorage.removeItem(STORAGE_SERVER);
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_TOKEN) || null;
}

export function setAccessToken(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(STORAGE_TOKEN, token);
  else localStorage.removeItem(STORAGE_TOKEN);
}

export function buildAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function getTerminalId() {
  if (typeof window === 'undefined') return 'web';
  return sessionStorage.getItem(STORAGE_TERMINAL) || 'web-mobile';
}

export function setTerminalId(id) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_TERMINAL, id || 'web-mobile');
}

/** API base for browser clients — empty string = same-origin (/api via proxy or server-hosted UI). */
export function getApiBase() {
  if (isElectron) return null;
  const stored = getStoredServerUrl();
  if (stored) return stored;
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  return '';
}

export function apiUrl(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

export function parseAppHash() {
  if (typeof window === 'undefined') return {};
  const raw = window.location.hash.slice(1).replace(/^\/?/, '');
  const [route, query] = raw.split('?');
  if (route === 'steam-tablet') return { uiMode: 'steam-tablet', module: 'steam' };
  if (route === 'manager') return { module: 'managerdashboard' };
  if (route === 'connect') return { forceConnect: true };
  return {};
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function buildMobileUrls(baseUrl, paths = {}) {
  const base = (baseUrl || '').replace(/\/$/, '');
  return {
    home: base || '/',
    steamTablet: `${base}/#steam-tablet`,
    manager: `${base}/#manager`,
    connect: `${base}/#connect`,
    ...paths,
  };
}
