import React, { useState } from 'react';
import { Btn, Field, Input } from './ui';
import {
  setStoredServerUrl,
  setTerminalId,
  setAccessToken,
  getAccessToken,
  isElectron,
} from '../utils/mobileAccess';
import { testServerConnection } from '../hooks/useDb';

function MobileConnect({ onConnected }) {
  const [serverUrl, setServerUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('facilityos_server_url');
    if (stored) return stored;
    const { protocol, hostname, port } = window.location;
    if (port === '3847') return `${protocol}//${hostname}:${port}`;
    return '';
  });
  const [accessToken, setAccessTokenLocal] = useState(() => getAccessToken() || '');
  const [terminalId, setTerminalIdLocal] = useState('mobile-1');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [needsToken, setNeedsToken] = useState(false);

  async function connect() {
    const url = serverUrl.trim();
    if (!url) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await testServerConnection(url, accessToken.trim() || undefined);
      if (!result.ok) {
        if (result.error === 'access_token_required') setNeedsToken(true);
        const messages = {
          access_token_required: 'This server requires an access token for remote connections.',
          invalid_access_token: 'Invalid access token — check Settings → Remote on the server PC.',
          remote_access_disabled: 'Remote access is disabled. Enable it on the server PC or use facility Wi‑Fi.',
          lan_only: 'Server is LAN-only. Connect on the same Wi‑Fi or enable remote access.',
        };
        setStatus({ ok: false, message: messages[result.error] || result.error || 'Cannot reach server' });
        return;
      }
      setStoredServerUrl(url);
      if (accessToken.trim()) setAccessToken(accessToken.trim());
      setTerminalId(terminalId.trim() || 'web-mobile');
      onConnected?.(result.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-4 safe-area-pad">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💧</div>
          <h1 className="text-xl font-bold text-gray-900">Connect to FacilityOS</h1>
          <p className="text-sm text-gray-500 mt-2">
            Facility Wi‑Fi or remote HTTPS URL — works on iPhone, iPad, and tablets.
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Server URL">
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://facilityos.example.com or http://192.168.1.50:3847"
              autoComplete="off"
              inputMode="url"
            />
          </Field>
          {(needsToken || accessToken) && (
            <Field label="Access token (remote connections)">
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessTokenLocal(e.target.value)}
                placeholder="From Settings → Remote on server PC"
                autoComplete="off"
              />
            </Field>
          )}
          <Field label="Device name (optional)">
            <Input
              value={terminalId}
              onChange={(e) => setTerminalIdLocal(e.target.value)}
              placeholder="manager-iphone"
            />
          </Field>

          {status && !status.ok && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{status.message}</p>
          )}

          <Btn className="w-full min-h-[44px]" onClick={connect} disabled={busy || !serverUrl.trim()}>
            {busy ? 'Connecting…' : 'Connect'}
          </Btn>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-2">
          <p><strong>On-site:</strong> use <code className="bg-gray-100 px-1 rounded">http://&lt;server-ip&gt;:3847</code> on facility Wi‑Fi.</p>
          <p><strong>Anywhere:</strong> admin enables Remote access + tunnel — see REMOTE_ACCESS.md.</p>
          <p><strong>Steam tablet:</strong> bookmark <code className="bg-gray-100 px-1 rounded">…/#steam-tablet</code></p>
        </div>
      </div>
    </div>
  );
}

export function MobileConnectGate({ children }) {
  const [ready, setReady] = useState(isElectron);
  const [checking, setChecking] = useState(!isElectron);

  React.useEffect(() => {
    if (isElectron) return undefined;

    let cancelled = false;
    (async () => {
      const health = await checkServerHealth();
      if (cancelled) return;
      setReady(!!health.ok);
      setChecking(false);
    })();

    return () => { cancelled = true; };
  }, []);

  if (isElectron || ready) return children;

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Connecting…</div>
      </div>
    );
  }

  return <MobileConnect onConnected={() => setReady(true)} />;
}

export default MobileConnectGate;
