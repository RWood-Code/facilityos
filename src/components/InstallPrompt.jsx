import React, { useEffect, useState } from 'react';
import { isIos, isStandalonePwa } from '../utils/mobileAccess';
import { Btn } from './ui';

export default function InstallPrompt({ variant = 'staff' }) {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (isStandalonePwa()) return undefined;

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    if (isIos()) {
      const dismissed = sessionStorage.getItem('facilityos_install_dismissed');
      if (!dismissed) setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  const isCloud = variant === 'cloud';

  return (
    <div className={`lg:hidden ${isCloud ? 'bg-indigo-700 border-indigo-800' : 'bg-cyan-700 border-cyan-800'} text-white px-4 py-3 text-sm flex items-start gap-3 border-b`}>
      <span className="text-lg flex-shrink-0">📲</span>
      <div className="flex-1 min-w-0">
        <strong>{isCloud ? 'Install FacilityOS Cloud' : 'Add to Home Screen'}</strong>
        {deferredPrompt ? (
          <p className={`mt-0.5 ${isCloud ? 'text-indigo-100' : 'text-cyan-100'}`}>
            Install this app for quick access to your manager dashboard and alerts.
          </p>
        ) : (
          <p className={`mt-0.5 ${isCloud ? 'text-indigo-100' : 'text-cyan-100'}`}>
            Tap Share in Safari, then &quot;Add to Home Screen&quot; — opens like an app next time.
          </p>
        )}
        {deferredPrompt && (
          <Btn size="sm" className="mt-2 bg-white text-gray-900 hover:bg-gray-100" onClick={installApp}>
            Install app
          </Btn>
        )}
      </div>
      <button
        type="button"
        className={`${isCloud ? 'text-indigo-200' : 'text-cyan-200'} flex-shrink-0 px-2`}
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
