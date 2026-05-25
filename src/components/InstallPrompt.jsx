import React, { useEffect, useState } from 'react';
import { isIos, isStandalonePwa } from '../utils/mobileAccess';

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) return;
    if (isIos()) {
      const dismissed = sessionStorage.getItem('facilityos_install_dismissed');
      if (!dismissed) setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="lg:hidden bg-slate-800 text-white px-4 py-3 text-xs flex items-start gap-3 border-b border-slate-700">
      <span className="text-lg flex-shrink-0">📲</span>
      <div className="flex-1 min-w-0">
        <strong>Add to Home Screen</strong>
        <p className="text-slate-300 mt-0.5">
          Tap Share → Add to Home Screen for quick manager access like an app.
        </p>
      </div>
      <button
        type="button"
        className="text-slate-400 flex-shrink-0 px-2"
        onClick={() => {
          sessionStorage.setItem('facilityos_install_dismissed', '1');
          setVisible(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
