import React, { useEffect, useState, Suspense } from 'react';
import { useAppStore } from './store/appStore';
import { Toasts, Spinner } from './components/ui';
import ModuleGate from './components/ModuleGate';
import UpdateBanner from './components/UpdateBanner';
import LicenceExpiryBanner, { LicenceExpiryBannerSpacer } from './components/LicenceExpiryBanner';
import InstallPrompt from './components/InstallPrompt';
import StaffSignIn from './components/StaffSignIn';
import MobileNav from './components/MobileNav';
import ModulesMenu from './components/ModulesMenu';
import SteamTablet from './modules/steam/SteamTablet';
import AppLayout from './layout/AppLayout';
import { dbQuery, checkServerHealth, isElectron } from './hooks/useDb';
import { useMediaQuery } from './hooks/useMediaQuery';
import { buildNavGroups, buildMobileNavItems, MODULE_MAP, MODULE_TITLES } from './config/modules';
import { parseAppHash } from './utils/mobileAccess';
import { isCloudClientMode, getCloudSession } from './utils/cloudRelay';
import CloudManagerView from './modules/cloud/CloudManagerView';

export default function App() {
  const {
    currentModule, setModule, settings, setSettings, toasts, facility, currentStaff,
    licence, setLicence, uiMode, setUiMode, sidebarOpen, setSidebarOpen, setSelectedPoolId,
  } = useAppStore();
  const [connection, setConnection] = useState({ ok: true });
  const [showSignIn, setShowSignIn] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    if (window.facilityos || window.db) {
      navigator.serviceWorker?.getRegistrations?.()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const route = parseAppHash();
    if (route.uiMode) setUiMode(route.uiMode);
    if (route.module) setModule(route.module);
  }, [setModule, setUiMode]);

  useEffect(() => {
    window.facilityos?.setTitle?.(MODULE_TITLES[currentModule] || 'Dashboard');
  }, [currentModule]);

  useEffect(() => {
    if (!isElectron() && isMobile && !currentStaff) setShowSignIn(true);
  }, [isMobile, currentStaff]);

  useEffect(() => {
    dbQuery('settings:all').then((s) => setSettings(s || {})).catch(() => {});
    dbQuery('licence:status').then(setLicence).catch(() => {});
    const poll = () => checkServerHealth().then(setConnection);
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [setSettings, setLicence]);

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

  if (!isElectron() && isCloudClientMode() && getCloudSession()) {
    return (
      <>
        <CloudManagerView />
        <Toasts toasts={toasts} />
      </>
    );
  }

  return (
    <>
      <LicenceExpiryBanner />
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <LicenceExpiryBannerSpacer />
          {!isElectron() && <InstallPrompt />}
          <UpdateBanner />
          <AppLayout
            nav={nav}
            currentModule={currentModule}
            setModule={setModule}
            setSelectedPoolId={setSelectedPoolId}
            settings={settings}
            facility={facility}
            licence={licence}
            connection={connection}
            currentStaff={currentStaff}
            isMobile={isMobile}
            onOpenModules={() => setSidebarOpen(true)}
          >
            <ModuleGate moduleId={currentModule}>
              <Suspense fallback={<Spinner />}>
                <ActiveModule key={currentModule} />
              </Suspense>
            </ModuleGate>
          </AppLayout>

          {isMobile && (
            <MobileNav
              items={mobileNav}
              currentModule={currentModule}
              onSelect={(id) => setModule(id)}
              onMore={() => setSidebarOpen(true)}
            />
          )}
        </div>

        <ModulesMenu
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          nav={nav}
          currentModule={currentModule}
          onSelect={setModule}
        />

        <Toasts toasts={toasts} />
        {showSignIn && !currentStaff && (
          <StaffSignIn onDone={() => setShowSignIn(false)} />
        )}
      </div>
    </>
  );
}
