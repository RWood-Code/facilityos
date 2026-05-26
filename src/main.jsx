import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LicenseGate from './components/LicenseGate';
import { MobileConnectGate } from './components/MobileConnect';
import './index.css';

const isDesktopShell = !!(window.facilityos || window.db);

if ('serviceWorker' in navigator && import.meta.env.PROD && !isDesktopShell) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
} else if (isDesktopShell && 'serviceWorker' in navigator) {
  navigator.serviceWorker?.getRegistrations?.()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LicenseGate>
      <MobileConnectGate>
        <App />
      </MobileConnectGate>
    </LicenseGate>
  </React.StrictMode>
);
