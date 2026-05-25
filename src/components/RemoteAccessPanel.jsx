import React, { useEffect, useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Input } from './ui';

export default function RemoteAccessPanel() {
  const { toast } = useAppStore();
  const [status, setStatus] = useState(null);
  const [revealedToken, setRevealedToken] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState(() => localStorage.getItem('facilityos_tunnel_url') || '');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const s = await dbQuery('remote:status');
    setStatus(s);
  }

  useEffect(() => { refresh(); }, []);

  async function enable() {
    setBusy(true);
    try {
      const r = await dbQuery('remote:enable');
      setRevealedToken(r.token);
      await refresh();
      toast('Remote access enabled — copy the access token now');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await dbQuery('remote:disable');
      setRevealedToken('');
      await refresh();
      toast('Remote access disabled');
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    try {
      const r = await dbQuery('remote:rotate_token');
      setRevealedToken(r.token);
      await refresh();
      toast('New access token generated');
    } finally {
      setBusy(false);
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text);
    toast('Copied');
  }

  const publicBase = tunnelUrl.replace(/\/$/, '');
  const remoteLinks = publicBase ? [
    ['Mobile app', `${publicBase}/`],
    ['Manager', `${publicBase}/#manager`],
    ['Steam tablet', `${publicBase}/#steam-tablet`],
  ] : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Remote access (anywhere)</h3>
        <p className="text-xs text-gray-500 mt-1">
          Allow managers and mobile devices outside the facility LAN using a secure tunnel + access token.
          Facility terminals on local Wi‑Fi do not need the token.
        </p>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-xs ${status?.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
        {status?.enabled
          ? `Remote access enabled · token …${status.tokenPreview || '????'}`
          : 'Remote access disabled — LAN-only by default'}
      </div>

      <div className="flex flex-wrap gap-2">
        {!status?.enabled ? (
          <Btn onClick={enable} disabled={busy}>Enable remote access</Btn>
        ) : (
          <>
            <Btn variant="secondary" onClick={rotate} disabled={busy}>Rotate token</Btn>
            <Btn variant="secondary" onClick={disable} disabled={busy}>Disable</Btn>
          </>
        )}
      </div>

      {revealedToken && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <p className="text-xs text-amber-900 font-semibold">Access token — copy now (shown once per action)</p>
          <code className="block text-xs break-all bg-white border border-amber-100 rounded p-2">{revealedToken}</code>
          <Btn size="sm" variant="secondary" onClick={() => copy(revealedToken)}>Copy token</Btn>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Tunnel setup</h4>
        <p className="text-xs text-gray-500">
          Expose port 3847 securely using Cloudflare Tunnel, Tailscale Funnel, or ngrok. Paste your public HTTPS URL below for copy-ready mobile links.
        </p>
        <Field label="Public tunnel URL (HTTPS)">
          <Input
            value={tunnelUrl}
            onChange={(e) => {
              setTunnelUrl(e.target.value);
              localStorage.setItem('facilityos_tunnel_url', e.target.value);
            }}
            placeholder="https://facilityos.yourdomain.com"
          />
        </Field>
        {remoteLinks.length > 0 && (
          <div className="space-y-2">
            {remoteLinks.map(([label, url]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-xs text-gray-500 sm:w-28">{label}</span>
                <code className="text-xs bg-gray-50 border rounded px-2 py-1 flex-1 break-all">{url}</code>
                <Btn size="sm" variant="secondary" onClick={() => copy(url)}>Copy</Btn>
              </div>
            ))}
            <p className="text-xs text-gray-400">Mobile users enter the tunnel URL + access token on first connect.</p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
        <strong>Security:</strong> Token required for non-LAN API calls when enabled. Use HTTPS tunnels only.
        See <code className="bg-white px-1 rounded">REMOTE_ACCESS.md</code> for Cloudflare Tunnel steps and future cloud-hosted options.
      </div>
    </div>
  );
}
