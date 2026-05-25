import React, { useEffect, useState } from 'react';
import { Btn } from './ui';

export default function UpdateBanner() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.facilityos?.onUpdateStatus) return undefined;
    return window.facilityos.onUpdateStatus((payload) => {
      setStatus(payload);
    });
  }, []);

  if (!status || status.event === 'checking' || status.event === 'not-available') return null;

  if (status.event === 'error') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800">
        Update check failed: {status.message}
      </div>
    );
  }

  if (status.event === 'progress') {
    return (
      <div className="bg-cyan-50 border-b border-cyan-200 px-6 py-2 text-xs text-cyan-900 flex items-center gap-3">
        <span>Downloading update… {Math.round(status.percent || 0)}%</span>
      </div>
    );
  }

  if (status.event === 'available') {
    return (
      <div className="bg-cyan-50 border-b border-cyan-200 px-6 py-2 text-sm text-cyan-900 flex items-center gap-3 flex-wrap">
        <span>FacilityOS {status.version} is available.</span>
        <Btn size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await window.facilityos.downloadUpdate(); } finally { setBusy(false); }
        }}>
          Download
        </Btn>
      </div>
    );
  }

  if (status.event === 'downloaded') {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-sm text-emerald-900 flex items-center gap-3 flex-wrap">
        <span>Update {status.version} ready — restart to install.</span>
        <Btn size="sm" onClick={() => window.facilityos.installUpdate()}>Restart now</Btn>
      </div>
    );
  }

  return null;
}
