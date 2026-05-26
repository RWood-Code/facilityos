import {
  isElectron,
  getApiBase,
  apiUrl,
  getTerminalId,
  setStoredServerUrl,
  setTerminalId,
  setAccessToken,
  getAccessToken,
  buildAuthHeaders,
} from '../utils/mobileAccess';

export {
  isElectron,
  getApiBase,
  setStoredServerUrl,
  setTerminalId,
  getTerminalId,
  setAccessToken,
  getAccessToken,
};

export async function dbQuery(channel, args) {
  if (isElectron()) {
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

  const res = await fetch(apiUrl('/api/query'), {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ channel, args: args ?? {}, terminalId: getTerminalId() }),
  });
  const result = await res.json();
  if (res.status === 401) {
    const err = new Error(result.error || 'remote_auth_required');
    err.code = result.error;
    throw err;
  }
  if (res.status === 402 || result.error === 'licence_expired') {
    const err = new Error('licence_expired');
    err.licence = result.data;
    throw err;
  }
  if (!result.ok) throw new Error(result.error || 'DB error');
  return result.data;
}

export async function checkServerHealth() {
  let base;
  if (isElectron()) {
    base = (await window.facilityos?.getConfig())?.serverUrl;
  } else {
    base = getApiBase();
  }
  if (base === null || base === undefined) {
    if (isElectron()) return { ok: false };
    base = '';
  }
  try {
    const res = await fetch(base ? `${base.replace(/\/$/, '')}/api/health` : apiUrl('/api/health'), {
      headers: buildAuthHeaders(),
    });
    return res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function testServerConnection(serverUrl, accessToken) {
  const url = (serverUrl || '').replace(/\/$/, '');
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  try {
    const res = await fetch(`${url}/api/health`, { headers });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    if (data.remoteAccess?.tokenRequired && !accessToken) {
      return { ok: false, error: 'access_token_required', data };
    }
    if (data.remoteAccess?.lanOnly && !accessToken) {
      return { ok: false, error: 'remote_access_disabled', data };
    }
    const probe = await fetch(`${url}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ channel: 'licence:status', args: {}, terminalId: 'connect-test' }),
    });
    const probeResult = await probe.json();
    if (probe.status === 401) {
      return { ok: false, error: 'invalid_access_token', data };
    }
    if (!probeResult.ok && probe.status !== 402) {
      return { ok: false, error: probeResult.error || 'connection_failed' };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
