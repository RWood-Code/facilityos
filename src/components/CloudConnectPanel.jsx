import React, { useEffect, useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Input } from './ui';

export default function CloudConnectPanel() {
  const { toast } = useAppStore();
  const [status, setStatus] = useState(null);
  const [relayUrl, setRelayUrl] = useState('http://127.0.0.1:4850');
  const [facilityName, setFacilityName] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const s = await dbQuery('cloud:status');
    setStatus(s);
    if (s?.relay_url) setRelayUrl(s.relay_url);
  }

  useEffect(() => { refresh(); }, []);

  async function saveConfig() {
    setBusy(true);
    try {
      await dbQuery('cloud:configure', { relay_url: relayUrl.trim() });
      await refresh();
      toast('Relay URL saved');
    } finally {
      setBusy(false);
    }
  }

  async function generatePairingCode() {
    setBusy(true);
    try {
      const r = await dbQuery('cloud:pairing_code');
      await refresh();
      toast(`Pairing code: ${r.code}`);
    } finally {
      setBusy(false);
    }
  }

  async function completePairing() {
    setBusy(true);
    try {
      const r = await dbQuery('cloud:pair', { facility_name: facilityName.trim() || undefined });
      await refresh();
      toast(`Paired with cloud · site ${r.site_id?.slice(0, 8)}…`);
    } catch (e) {
      toast(e.message || 'Pairing failed — is the relay running?', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      const r = await dbQuery('cloud:sync_now');
      await refresh();
      if (r.ok) toast(`Sync OK · pushed ${r.pushed || 0} event(s)`);
      else toast(r.error || 'Sync failed', 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function enqueueDemo() {
    setBusy(true);
    try {
      await dbQuery('cloud:enqueue_demo');
      await dbQuery('cloud:sync_now');
      await refresh();
      toast('Demo event queued and synced');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">FacilityOS Cloud</h3>
        <p className="text-xs text-gray-500 mt-1">
          Phase 1: pair this site with your hosted relay, then run the sync agent on the data server PC.
        </p>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-xs ${status?.paired ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        {status?.paired ? (
          <>
            Paired · site <code>{status.site_id?.slice(0, 12)}…</code>
            · pending {status.pending_events || 0}
            · last sync {status.last_sync_at || 'never'}
          </>
        ) : (
          'Not paired — start relay locally with npm run cloud:relay'
        )}
      </div>

      <Field label="Relay URL">
        <Input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)} placeholder="http://127.0.0.1:4850" />
      </Field>

      <Field label="Facility name (for pairing)">
        <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} placeholder="EA Networks Centre" />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Btn variant="secondary" onClick={saveConfig} disabled={busy}>Save relay URL</Btn>
        <Btn variant="secondary" onClick={generatePairingCode} disabled={busy}>1. Generate code</Btn>
        <Btn onClick={completePairing} disabled={busy || !status?.pairing_code}>2. Pair with relay</Btn>
      </div>

      {status?.pairing_code && (
        <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-3">
          <p className="text-xs text-cyan-900 font-semibold">Active pairing code</p>
          <code className="text-lg font-mono tracking-widest">{status.pairing_code}</code>
        </div>
      )}

      {status?.paired && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Btn variant="secondary" onClick={syncNow} disabled={busy}>Sync now</Btn>
          <Btn variant="secondary" onClick={enqueueDemo} disabled={busy}>Send demo event</Btn>
        </div>
      )}

      <div className="text-xs text-gray-500 bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1">
        <p><strong>Dev stack:</strong> <code>npm run cloud:dev</code> (server + relay + agent)</p>
        <p><strong>Production:</strong> deploy relay to your cloud; agent runs on facility PC outbound-only.</p>
        <p>Water tests and steam checks auto-queue to the outbox when cloud is enabled.</p>
      </div>
    </div>
  );
}
