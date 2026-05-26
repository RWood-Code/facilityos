import React, { useEffect, useState } from 'react';
import { Btn, Field, Input } from './ui';
import {
  cloudLogin,
  checkCloudRelayHealth,
  getCloudRelayUrl,
  getCloudSiteId,
  setCloudRelayUrl,
  setCloudSiteId,
  getCloudSession,
} from '../utils/cloudRelay';

export default function CloudLogin({ onConnected }) {
  const [relayUrl, setRelayUrlLocal] = useState(() => getCloudRelayUrl() || import.meta.env.VITE_CLOUD_RELAY_URL || '');
  const [siteId, setSiteIdLocal] = useState(() => getCloudSiteId() || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkCloudRelayHealth().then(setHealth);
  }, [relayUrl]);

  async function connect() {
    setBusy(true);
    setStatus(null);
    try {
      setCloudRelayUrl(relayUrl.trim());
      setCloudSiteId(siteId.trim());
      await cloudLogin({ siteId: siteId.trim(), email: email.trim(), password });
      onConnected?.(getCloudSession());
    } catch (e) {
      const messages = {
        invalid_credentials: 'Email or password is incorrect.',
        site_not_found: 'Site ID not found on this relay.',
        cloud_relay_not_configured: 'Enter your relay URL first.',
      };
      setStatus({ ok: false, message: messages[e.message] || 'Could not sign in. Check your details and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-cyan-900 flex items-center justify-center p-4 safe-area-pad">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">☁️</div>
          <h1 className="text-xl font-bold text-gray-900">FacilityOS Cloud</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to view your facility dashboard from anywhere.</p>
        </div>

        {health?.ok && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4">
            Relay online · {health.version || 'connected'}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Cloud relay URL">
            <Input
              value={relayUrl}
              onChange={(e) => setRelayUrlLocal(e.target.value)}
              placeholder="https://relay.facilityos.nz"
              inputMode="url"
            />
          </Field>
          <Field label="Site ID">
            <Input
              value={siteId}
              onChange={(e) => setSiteIdLocal(e.target.value)}
              placeholder="From Settings → Cloud after pairing"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          {status && !status.ok && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{status.message}</p>
          )}

          <Btn className="w-full min-h-[44px]" onClick={connect} disabled={busy || !relayUrl.trim() || !siteId.trim() || !email.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Btn>
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Ask your facility administrator to create your cloud login in Settings → Cloud.
        </p>
      </div>
    </div>
  );
}

export function CloudConnectGate({ children }) {
  const cloudMode = !!(import.meta.env.VITE_CLOUD_RELAY_URL || (typeof window !== 'undefined' && localStorage.getItem('facilityos_cloud_relay_url')));
  const [ready, setReady] = useState(() => !cloudMode || !!getCloudSession());
  const [checking, setChecking] = useState(cloudMode && !getCloudSession());

  useEffect(() => {
    if (!cloudMode) return undefined;
    if (getCloudSession()) {
      setReady(true);
      setChecking(false);
      return undefined;
    }
    setChecking(false);
    return undefined;
  }, [cloudMode]);

  if (!cloudMode) return children;
  if (ready) return children;

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  return <CloudLogin onConnected={() => setReady(true)} />;
}
