import React, { useEffect, useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { Btn, Field, Input } from './ui';

export default function LicenseGate({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [expiry, setExpiry] = useState('');
  const [adminMode, setAdminMode] = useState(false);

  const load = () => dbQuery('licence:status').then(setStatus).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function activate() {
    if (!key || !expiry) return;
    await dbQuery('licence:activate', { licence_key: key, expires_at: expiry, organisation: 'Licensed facility' });
    load();
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">Validating licence…</div>
      </div>
    );
  }

  if (status?.valid) return children;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💧</div>
          <h1 className="text-xl font-bold text-gray-900">FacilityOS</h1>
          <p className="text-sm text-red-600 mt-2 font-medium">Licence expired or invalid</p>
          {status?.expires_at && (
            <p className="text-xs text-gray-500 mt-1">Expired: {status.expires_at.slice(0, 10)}</p>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4 text-center">
          Contact your administrator to renew your subscription, or enter a licence key below.
        </p>
        <button
          type="button"
          className="text-xs text-cyan-600 mb-4 block mx-auto"
          onClick={() => setAdminMode(!adminMode)}
        >
          {adminMode ? 'Hide activation' : 'Administrator: activate licence'}
        </button>
        {adminMode && (
          <div className="space-y-3 border-t pt-4">
            <Field label="Licence key">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="FACILITYOS-XXXX" />
            </Field>
            <Field label="Expires (YYYY-MM-DD)">
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
            <Btn className="w-full" onClick={activate}>Activate licence</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
