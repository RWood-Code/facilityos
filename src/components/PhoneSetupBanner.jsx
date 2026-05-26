import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';

/** Shown on the server PC dashboard — points staff to the QR code. */
export default function PhoneSetupBanner({ onOpenSettings }) {
  const { setModule } = useAppStore();
  const [isServer, setIsServer] = useState(false);

  useEffect(() => {
    window.facilityos?.getConfig().then((c) => setIsServer(c?.role === 'server')).catch(() => {});
  }, []);

  if (!isServer) return null;

  function openPhones() {
    if (onOpenSettings) onOpenSettings('phones');
    else {
      setModule('settings');
      window.location.hash = 'phones';
    }
  }

  return (
    <button
      type="button"
      onClick={openPhones}
      className="w-full mb-4 flex items-center gap-3 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-4 text-left hover:shadow-md transition-shadow"
    >
      <span className="text-2xl">📱</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">Phones & tablets</div>
        <div className="text-xs text-gray-600">Tap here to show the QR code for staff Wi‑Fi access</div>
      </div>
      <span className="text-cyan-600 text-sm font-medium flex-shrink-0">Show QR →</span>
    </button>
  );
}
