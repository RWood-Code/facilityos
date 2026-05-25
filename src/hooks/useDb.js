const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3847';

const isElectron = typeof window !== 'undefined' && typeof window.db !== 'undefined';

export async function dbQuery(channel, args) {
  if (isElectron) {
    const result = await window.db.query(channel, args);
    if (!result.ok) {
      if (result.error === 'licence_expired') {
        const err = new Error('licence_expired');
        err.licence = result.data;
        throw err;
      }
      throw new Error(result.error || 'DB error');
    }
    return result.data;
  }

  const terminalId = sessionStorage.getItem('facilityos_terminal') || 'web-dev';
  const res = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, args: args ?? {}, terminalId }),
  });
  const result = await res.json();
  if (res.status === 402 || result.error === 'licence_expired') {
    const err = new Error('licence_expired');
    err.licence = result.data;
    throw err;
  }
  if (!result.ok) throw new Error(result.error || 'DB error');
  return result.data;
}

export async function checkServerHealth() {
  const base = isElectron
    ? (await window.facilityos?.getConfig())?.serverUrl
    : API_BASE;
  if (!base) return { ok: false };
  try {
    const res = await fetch(`${base}/api/health`);
    return res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
