import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LicenseGate from './components/LicenseGate';
import { MobileConnectGate } from './components/MobileConnect';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
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
