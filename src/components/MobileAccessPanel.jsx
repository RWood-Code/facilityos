import React, { useEffect, useState } from 'react';
import { Btn } from './ui';
import { checkServerHealth } from '../hooks/useDb';
import { isElectron } from '../utils/mobileAccess';

function copyText(text, onDone) {
  navigator.clipboard?.writeText(text).then(() => onDone?.());
}

export default function MobileAccessPanel() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkServerHealth().then(setHealth);
  }, []);

  const urls = health?.mobileUrls || [];
  const webReady = health?.webUiAvailable;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Mobile & tablet access</h3>
        <p className="text-xs text-gray-500 mt-1">
          iPhone, iPad, and steam-room tablets use a browser on the same Wi‑Fi — no App Store install.
          {isElectron ? ' Build the web UI once with npm run build on the server PC.' : ''}
        </p>
      </div>

      {!webReady && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          Web UI not deployed yet. On the data server PC run <code className="bg-amber-100 px-1 rounded">npm run build</code>, then restart FacilityOS.
        </div>
      )}

      {urls.length === 0 ? (
        <p className="text-xs text-gray-500">
          LAN addresses will appear here when the data server is running. Ensure port {health?.port || 3847} is allowed through firewall.
        </p>
      ) : (
        <div className="space-y-3">
          {urls.map((row) => (
            <div key={row.ip} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700">Network: {row.ip}</div>
              {[
                ['Full app', row.home],
                ['Steam room tablet (kiosk)', row.steamTablet],
                ['Manager dashboard', row.manager],
              ].map(([label, url]) => (
                <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-xs text-gray-500 sm:w-40 flex-shrink-0">{label}</span>
                  <code className="text-xs bg-white border border-gray-200 rounded px-2 py-1 flex-1 break-all">{url}</code>
                  <Btn variant="secondary" size="sm" className="flex-shrink-0" onClick={() => copyText(url, () => {})}>
                    Copy
                  </Btn>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
        <p><strong>Steam tablet:</strong> open the steam-tablet link → Add to Home Screen → enable guided access / kiosk if available.</p>
        <p><strong>Manager iPhone:</strong> open the manager link → Share → Add to Home Screen for app-like access.</p>
        <p><strong>Development:</strong> run <code className="bg-gray-100 px-1 rounded">npm run dev:mobile</code> and open http://&lt;PC-IP&gt;:5173 on the device.</p>
      </div>
    </div>
  );
}
