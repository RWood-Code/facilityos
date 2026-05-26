import React, { useState } from 'react';
import { Btn, Field, Input } from './ui';
import {
  setStoredServerUrl,
  setTerminalId,
  setAccessToken,
  getAccessToken,
  isElectron,
} from '../utils/mobileAccess';
import { testServerConnection, checkServerHealth } from '../hooks/useDb';

function MobileConnect({ onConnected }) {
  const [serverUrl, setServerUrl] = useState('');
  const [accessToken, setAccessTokenLocal] = useState(() => getAccessToken() || '');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
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
          access_token_required: 'This connection needs a code from your administrator.',
          invalid_access_token: 'That code is not correct — ask your administrator.',
          remote_access_disabled: 'Use the facility Wi‑Fi instead.',
          lan_only: 'Join the facility Wi‑Fi, then try again.',
        };
        setStatus({ ok: false, message: messages[result.error] || 'Could not connect. Check Wi‑Fi and try scanning the QR code on the office PC.' });
        return;
      }
      setStoredServerUrl(url);
      if (accessToken.trim()) setAccessToken(accessToken.trim());
      setTerminalId('mobile');
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
          <h1 className="text-xl font-bold text-gray-900">FacilityOS</h1>
        </div>

        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-gray-900">To get started:</p>
            <p>1. Connect to the <strong>facility Wi‑Fi</strong></p>
            <p>2. On the office computer, open <strong>Settings → Phones & tablets</strong></p>
            <p>3. Scan the <strong>QR code</strong> with your phone camera</p>
          </div>

          {!showManual ? (
            <button
              type="button"
              className="w-full text-center text-xs text-gray-500 underline"
              onClick={() => setShowManual(true)}
            >
              Enter address manually instead
            </button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <Field label="Address from the office PC">
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.50:3847"
                  autoComplete="off"
                  inputMode="url"
                />
              </Field>
              {needsToken && (
                <Field label="Access code">
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessTokenLocal(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
              )}
              {status && !status.ok && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{status.message}</p>
              )}
              <Btn className="w-full min-h-[44px]" onClick={connect} disabled={busy || !serverUrl.trim()}>
                {busy ? 'Connecting…' : 'Connect'}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MobileConnectGate({ children }) {
  const [ready, setReady] = useState(() => isElectron());
  const [checking, setChecking] = useState(() => !isElectron());

  React.useEffect(() => {
    if (isElectron()) return undefined;

    let cancelled = false;
    (async () => {
      const { protocol, hostname, port } = window.location;
      if (port === '3847') {
        const health = await checkServerHealth();
        if (!cancelled && health.ok) {
          setReady(true);
          setChecking(false);
          return;
        }
      }

      const health = await checkServerHealth();
      if (cancelled) return;
      if (health.ok) {
        setReady(true);
        setChecking(false);
        return;
      }
      const stored = localStorage.getItem('facilityos_server_url');
      if (stored) {
        const remote = await testServerConnection(stored, getAccessToken() || undefined);
        if (!cancelled && remote.ok) {
          setReady(true);
          setChecking(false);
          return;
        }
      }
      setChecking(false);
    })();

    return () => { cancelled = true; };
  }, []);

  if (isElectron() || ready) return children;

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  return <MobileConnect onConnected={() => setReady(true)} />;
}

export default MobileConnectGate;
