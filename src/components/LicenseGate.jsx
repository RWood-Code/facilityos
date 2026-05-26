import React, { useEffect, useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useLicenceCountdown } from '../hooks/useLicenceCountdown';
import { TRIAL_DAYS } from '../utils/licenceExpiry';
import { Btn, Field, Input } from './ui';

export default function LicenseGate({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [expiry, setExpiry] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [trialWelcome, setTrialWelcome] = useState(false);
  const countdown = useLicenceCountdown(status?.expires_at);

  async function load() {
    let s = await dbQuery('licence:status');
    if (!s?.valid && s?.reason === 'no_licence') {
      await dbQuery('licence:ensure_trial');
      s = await dbQuery('licence:status');
    }
    setStatus(s);
    if (s?.valid && s?.isTrial) {
      try {
        if (!localStorage.getItem('facilityos_trial_welcome')) setTrialWelcome(true);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function activate() {
    if (!key || !expiry) return;
    await dbQuery('licence:activate', {
      licence_key: key,
      expires_at: expiry,
      organisation: 'Licensed facility',
    });
    try { localStorage.setItem('facilityos_trial_welcome', '1'); } catch { /* ignore */ }
    setTrialWelcome(false);
    load();
  }

  function dismissTrialWelcome() {
    try { localStorage.setItem('facilityos_trial_welcome', '1'); } catch { /* ignore */ }
    setTrialWelcome(false);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Validating licence…</div>
      </div>
    );
  }

  if (!status?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">💧</div>
            <h1 className="text-xl font-bold text-gray-900">FacilityOS</h1>
            <p className="text-sm text-red-600 mt-2 font-medium">
              {status?.isTrial ? 'Your evaluation trial has ended' : 'Licence expired or invalid'}
            </p>
            {status?.expires_at && (
              <p className="text-xs text-gray-500 mt-2">
                Expired {status.expires_at.slice(0, 10)}
                {countdown.expired && ` · ${countdown.label}`}
              </p>
            )}
            {status?.expires_at && !countdown.expired && (
              <p className="font-mono text-lg text-red-700 mt-3 tabular-nums">{countdown.label}</p>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4 text-center">
            Enter a licence key from your vendor to continue using FacilityOS.
          </p>
          <div className="space-y-3">
            <Field label="Licence key">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="FACILITYOS-XXXX" />
            </Field>
            <Field label="Expires (YYYY-MM-DD)">
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
            <Btn className="w-full" onClick={activate} disabled={!key || !expiry}>Activate licence</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (trialWelcome) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">⏳</div>
            <h1 className="text-xl font-bold text-gray-900">Welcome to FacilityOS</h1>
            <p className="text-sm text-cyan-700 mt-2 font-medium">
              Your {TRIAL_DAYS}-day evaluation trial is active
            </p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-center mb-6">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-2">Time remaining</p>
            <p className="font-mono text-2xl text-cyan-900 tabular-nums">{countdown.label}</p>
            <p className="text-xs text-gray-500 mt-2">Expires {status.expires_at?.slice(0, 10)}</p>
          </div>
          <p className="text-sm text-gray-600 mb-6 text-center">
            Explore all trial features now. Before the trial ends, enter a licence key under Settings → Licence.
          </p>
          <Btn className="w-full" onClick={dismissTrialWelcome}>Continue to FacilityOS</Btn>
        </div>
      </div>
    );
  }

  return children;
}
