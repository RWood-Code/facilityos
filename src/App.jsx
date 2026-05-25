import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { Toasts } from './components/ui';
import ModuleGate from './components/ModuleGate';
import UpdateBanner from './components/UpdateBanner';
import InstallPrompt from './components/InstallPrompt';
import StaffSignIn from './components/StaffSignIn';
import MobileNav from './components/MobileNav';
import SteamTablet from './modules/steam/SteamTablet';
import { dbQuery, checkServerHealth, isElectron } from './hooks/useDb';
import { useMediaQuery } from './hooks/useMediaQuery';
import { buildNavGroups, buildMobileNavItems, MODULE_MAP, MODULE_TITLES } from './config/modules';
import { parseAppHash } from './utils/mobileAccess';

function SidebarContent({ nav, currentModule, setModule, connection, settings, facility, currentStaff, onNavigate }) {
  return (
    <>
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
                onClick={() => { setModule(item.id); onNavigate?.(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left mb-0.5 min-h-[44px]
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
    </>
  );
}

export default function App() {
  const {
    currentModule, setModule, settings, setSettings, toasts, facility, currentStaff,
    licence, setLicence, uiMode, setUiMode, sidebarOpen, setSidebarOpen,
  } = useAppStore();
  const [connection, setConnection] = useState({ ok: true });
  const [showSignIn, setShowSignIn] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    const route = parseAppHash();
    if (route.uiMode) setUiMode(route.uiMode);
    if (route.module) setModule(route.module);
  }, [setModule, setUiMode]);

  useEffect(() => {
    window.facilityos?.setTitle?.(MODULE_TITLES[currentModule] || 'Dashboard');
  }, [currentModule]);

  useEffect(() => {
    if (!isElectron && isMobile && !currentStaff) setShowSignIn(true);
  }, [isMobile, currentStaff]);

  useEffect(() => {
    dbQuery('settings:all').then((s) => setSettings(s || {})).catch(() => {});
    dbQuery('licence:status').then(setLicence).catch(() => {});
    const poll = () => checkServerHealth().then(setConnection);
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [setSettings, setLicence]);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile, setSidebarOpen]);

  const nav = buildNavGroups(settings, licence);
  const mobileNav = buildMobileNavItems(settings, licence);
  const ActiveModule = MODULE_MAP[currentModule] || MODULE_MAP.dashboard;

  function exitTabletMode() {
    setUiMode('normal');
    window.location.hash = '';
  }

  if (uiMode === 'steam-tablet') {
    return (
      <>
        <SteamTablet onExit={exitTabletMode} />
        <Toasts toasts={toasts} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-gradient-to-b from-slate-900 to-slate-800 flex-col overflow-hidden shadow-xl">
        <SidebarContent
          nav={nav}
          currentModule={currentModule}
          setModule={setModule}
          connection={connection}
          settings={settings}
          facility={facility}
          currentStaff={currentStaff}
        />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col shadow-2xl">
            <SidebarContent
              nav={nav}
              currentModule={currentModule}
              setModule={setModule}
              connection={connection}
              settings={settings}
              facility={facility}
              currentStaff={currentStaff}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isElectron && <InstallPrompt />}
        <UpdateBanner />
        <header className="h-14 bg-white/90 backdrop-blur border-b border-gray-200/80 flex items-center px-4 md:px-6 gap-3 flex-shrink-0 safe-area-top">
          {isMobile && (
            <button
              type="button"
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 -ml-1"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
          )}
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 flex-1 truncate">
            {MODULE_TITLES[currentModule] || 'Dashboard'}
          </h1>
          {licence?.planLabel && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 hidden md:inline">{licence.planLabel}</span>
          )}
          {currentStaff && (
            <span className="text-xs text-gray-500 hidden sm:inline truncate max-w-[120px]">{currentStaff.name}</span>
          )}
        </header>

        <main className={`flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-br from-slate-50 to-gray-100/80 ${isMobile ? 'pb-24' : ''}`}>
          <ModuleGate moduleId={currentModule}>
            <ActiveModule key={currentModule} />
          </ModuleGate>
        </main>

        {isMobile && (
          <MobileNav
            items={mobileNav}
            currentModule={currentModule}
            onSelect={(id) => setModule(id)}
            onMore={() => setSidebarOpen(true)}
          />
        )}
      </div>

      <Toasts toasts={toasts} />
      {showSignIn && !currentStaff && (
        <StaffSignIn onDone={() => setShowSignIn(false)} />
      )}
    </div>
  );
}
