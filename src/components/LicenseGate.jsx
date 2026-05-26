import React, { useEffect, useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useLicenceCountdown } from '../hooks/useLicenceCountdown';
import { TRIAL_DAYS } from '../utils/licenceExpiry';
import { Btn, Field, Input } from './ui';

export default function LicenseGate({ children }) {
  const cloudHosted = !!(import.meta.env.VITE_CLOUD_RELAY_URL);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [licenceInput, setLicenceInput] = useState('');
  const [activateError, setActivateError] = useState('');
  const [activating, setActivating] = useState(false);
  const [trialWelcome, setTrialWelcome] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const countdown = useLicenceCountdown(status?.expires_at);

  async function load() {
    try {
      let s = await dbQuery('licence:status');
      if (!s?.valid && s?.reason === 'no_licence') {
        await dbQuery('licence:ensure_trial');
        s = await dbQuery('licence:status');
      }
      setStatus(s);
      try {
        const info = await dbQuery('licence:file_info');
        setFileInfo(info);
      } catch { /* ignore */ }
      if (s?.valid && s?.isTrial) {
        try {
          if (!localStorage.getItem('facilityos_trial_welcome')) setTrialWelcome(true);
        } catch { /* ignore */ }
      }
    } catch (e) {
      console.error('[LicenseGate]', e);
      setStatus({ valid: false, reason: 'server_error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function activate(licenceFile) {
    if (!licenceFile?.trim()) return;
    setActivating(true);
    setActivateError('');
    try {
      await dbQuery('licence:activate', { licence_file: licenceFile.trim() });
      try { localStorage.setItem('facilityos_trial_welcome', '1'); } catch { /* ignore */ }
      setTrialWelcome(false);
      setLicenceInput('');
      await load();
    } catch (e) {
      setActivateError(e.message || 'Activation failed');
    } finally {
      setActivating(false);
    }
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await activate(text);
    } catch (err) {
      setActivateError(err.message || 'Could not read licence file');
    }
    e.target.value = '';
  }

  function dismissTrialWelcome() {
    try { localStorage.setItem('facilityos_trial_welcome', '1'); } catch { /* ignore */ }
    setTrialWelcome(false);
  }

  if (cloudHosted) return children;

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
          </div>
          <p className="text-sm text-gray-600 mb-4 text-center">
            Install the signed <strong>facilityos.lic</strong> file from your vendor. Expiry and plan are verified cryptographically — they cannot be edited.
          </p>
          {fileInfo && (
            <p className="text-xs text-gray-500 mb-4 text-center break-all">
              Or save to: <code className="bg-gray-100 px-1 rounded">{fileInfo.directory}\{fileInfo.filename}</code> and restart FacilityOS.
            </p>
          )}
          <div className="space-y-3">
            <Field label="Upload licence file">
              <input
                type="file"
                accept=".lic,.json,application/json"
                onChange={onFileSelected}
                disabled={activating}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:text-cyan-800 file:font-medium"
              />
            </Field>
            <Field label="Or paste licence file contents">
              <Input
                value={licenceInput}
                onChange={(e) => setLicenceInput(e.target.value)}
                placeholder="Paste facilityos.lic JSON"
                autoComplete="off"
              />
            </Field>
            {activateError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{activateError}</p>
            )}
            <Btn className="w-full" onClick={() => activate(licenceInput)} disabled={!licenceInput.trim() || activating}>
              {activating ? 'Activating…' : 'Activate licence'}
            </Btn>
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
            Before the trial ends, install your vendor&apos;s <strong>facilityos.lic</strong> file under Settings → Licence.
          </p>
          <Btn className="w-full" onClick={dismissTrialWelcome}>Continue to FacilityOS</Btn>
        </div>
      </div>
    );
  }

  return children;
}
