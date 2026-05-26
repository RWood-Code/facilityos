import React, { useState } from 'react';
import IssuerForm from './components/IssuerForm';
import IssuedRegistry from './components/IssuedRegistry';

export default function App() {
  const [tab, setTab] = useState('issue');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-full py-8 px-4 md:px-8">
      <header className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-900/30">
            🔑
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">FacilityOS Licence Issuer</h1>
            <p className="text-cyan-100/80 text-sm">Vendor tool — generate keys for customer sites (not for end-user facilities)</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto mb-4 flex gap-2">
        {[['issue', 'Issue licence'], ['registry', 'Registry']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-slate-900 shadow-md' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto space-y-6">
        {tab === 'issue' && (
          <IssuerForm onIssued={() => setRefreshKey((k) => k + 1)} />
        )}
        {tab === 'registry' && (
          <IssuedRegistry refreshKey={refreshKey} />
        )}
      </main>

      <footer className="max-w-5xl mx-auto mt-10 text-center text-xs text-cyan-100/50">
        Registry stored locally in licence-issuer/data/issued.json · Keys activate on each site via FacilityOS
      </footer>
    </div>
  );
}
