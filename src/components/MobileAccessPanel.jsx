import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Btn } from './ui';
import { checkServerHealth } from '../hooks/useDb';
import { isElectron } from '../utils/mobileAccess';

export default function MobileAccessPanel() {
  const [health, setHealth] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkServerHealth().then(setHealth);
    const id = setInterval(() => checkServerHealth().then(setHealth), 5000);
    return () => clearInterval(id);
  }, []);

  const mainUrl = health?.mobileUrls?.[0]?.home || null;

  function copyLink() {
    if (!mainUrl) return;
    navigator.clipboard?.writeText(mainUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 max-w-lg">
      <div className="text-center">
        <div className="text-3xl mb-2">📱</div>
        <h3 className="text-lg font-bold text-gray-900">Connect phones & tablets</h3>
        <p className="text-sm text-gray-500 mt-1">No app store. Works on iPhone, iPad, and Android.</p>
      </div>

      {mainUrl ? (
        <>
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-2xl border-2 border-cyan-200 shadow-md">
              <QRCode value={mainUrl} size={200} level="M" />
            </div>
          </div>

          <ol className="text-sm text-gray-700 space-y-3">
            <li className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <span>On the phone, join the <strong>same Wi‑Fi</strong> as this computer</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span>Open the <strong>camera</strong> and scan the QR code above</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              <span>On iPhone/iPad: tap <strong>Share → Add to Home Screen</strong> (optional, for quick access)</span>
            </li>
          </ol>

          <Btn variant="secondary" className="w-full" onClick={copyLink}>
            {copied ? 'Link copied!' : 'Copy link to send by text or email'}
          </Btn>
        </>
      ) : (
        <div className="text-center text-sm text-gray-500 py-6">
          {isElectron()
            ? 'Starting… the QR code will appear in a few seconds once this computer is ready.'
            : 'Open FacilityOS on the main office computer to see the QR code.'}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
        Staff must be on facility Wi‑Fi. If scanning does not work, ask whoever installed FacilityOS to check the network.
      </p>
    </div>
  );
}
