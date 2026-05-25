import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { Toasts } from './components/ui';
import { dbQuery, checkServerHealth } from './hooks/useDb';
import { buildNavGroups, MODULE_MAP, MODULE_TITLES } from './config/modules';

export default function App() {
  const { currentModule, setModule, settings, setSettings, toasts, facility, currentStaff, setLicence } = useAppStore();
  const [connection, setConnection] = useState({ ok: true });

  useEffect(() => {
    dbQuery('settings:all').then((s) => setSettings(s || {})).catch(() => {});
    dbQuery('licence:status').then(setLicence).catch(() => {});
    const poll = () => checkServerHealth().then(setConnection);
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  const nav = buildNavGroups(settings);
  const ActiveModule = MODULE_MAP[currentModule] || MODULE_MAP.dashboard;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <aside className="w-60 flex-shrink-0 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col overflow-hidden shadow-xl">
        <div className="h-16 flex items-center px-4 gap-3 border-b border-slate-700/80 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-900/40">
            <span className="text-white text-base">💧</span>
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm tracking-tight">FacilityOS</div>
            <div className="text-slate-400 text-xs truncate">
              {settings.facility_name || facility?.name || 'Aquatic Centre'}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {nav.map((group) => (
            <div key={group.section} className="mb-2">
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {group.section}
              </div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModule(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left mb-0.5
                    ${currentModule === item.id
                      ? 'bg-cyan-600/90 text-white font-medium shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                  <span className="w-5 text-center flex-shrink-0 text-base">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/80 text-white font-semibold">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/80 space-y-2 flex-shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${connection.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
            <span className={`w-2 h-2 rounded-full ${connection.ok ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {connection.ok ? 'Server connected' : 'Server offline'}
          </div>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white text-xs font-bold">
              {(currentStaff?.name || settings.terminal_id || 'T1').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">
                {currentStaff?.name || `Terminal ${settings.terminal_id || 'T1'}`}
              </div>
              <div className="text-[10px] text-slate-500 capitalize">{currentStaff?.role?.replace('_', ' ') || 'Operations'}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white/90 backdrop-blur border-b border-gray-200/80 flex items-center px-6 gap-4 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900 flex-1">{MODULE_TITLES[currentModule] || 'Dashboard'}</h1>
          {currentStaff && (
            <span className="text-xs text-gray-500 hidden sm:inline">Signed in: {currentStaff.name}</span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-gray-100/80">
          <ActiveModule key={currentModule} />
        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}
