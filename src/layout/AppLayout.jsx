import React from 'react';
import {
  Droplets,
  ChevronDown,
  UserCircle,
  Settings,
  LayoutGrid,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '../lib/utils';

import NotificationBell from '../components/notifications/NotificationBell';

const QUICK_NAV_IDS = ['dashboard', 'pools', 'reports', 'managerdashboard', 'settings'];

export default function AppLayout({
  children,
  nav,
  currentModule,
  setModule,
  setSelectedPoolId,
  settings,
  facility,
  licence,
  connection,
  currentStaff,
  isMobile,
  onOpenModules,
}) {
  const facilityName = settings.facility_name || facility?.name || 'Aquatic Centre';

  const quickItems = nav.flatMap((g) => g.items).filter((item) => QUICK_NAV_IDS.includes(item.id));

  function goHome() {
    setModule('dashboard');
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 flex-shrink-0 safe-area-top">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand */}
            <button
              type="button"
              onClick={goHome}
              className="flex items-center gap-2 flex-shrink-0 min-w-0 text-left hover:opacity-90 transition-opacity"
            >
              <div className="p-1.5 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg shadow-sm">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-gray-900 text-lg leading-tight block">FacilityOS</span>
                <span className="hidden sm:block text-xs text-gray-400 font-normal truncate max-w-[200px]">
                  {facilityName}
                </span>
              </div>
            </button>

            {/* Desktop quick links */}
            {!isMobile && (
              <nav className="hidden md:flex items-center gap-1 flex-1 justify-center max-w-2xl" aria-label="Quick navigation">
                {quickItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModule(item.id)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      currentModule === item.id
                        ? 'bg-cyan-50 text-cyan-800'
                        : 'text-gray-600 hover:text-cyan-700 hover:bg-gray-50',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenModules}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-cyan-700 hover:bg-gray-50"
                >
                  <LayoutGrid className="w-4 h-4" />
                  All modules
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </nav>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className={cn(
                  'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                  connection.ok
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200',
                )}
                title={connection.ok ? 'Data server connected' : 'Data server offline'}
              >
                {connection.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">{connection.ok ? 'Connected' : 'Offline'}</span>
              </div>

              {licence?.planLabel && (
                <span className="hidden md:inline text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {licence.planLabel}
                </span>
              )}

              <NotificationBell
                onNavigate={setModule}
                onSelectPool={(poolId) => {
                  setSelectedPoolId?.(poolId);
                  setModule('poolhistory');
                }}
              />

              <button
                type="button"
                onClick={() => setModule('profile')}
                className={cn(
                  'hidden md:flex items-center gap-1.5 text-sm text-gray-600 hover:text-cyan-600 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-gray-50',
                  currentModule === 'profile' && 'text-cyan-700 bg-cyan-50',
                )}
              >
                <UserCircle className="w-4 h-4" />
                <span className="max-w-[120px] truncate">
                  {currentStaff?.name || 'Profile'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModule('settings')}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-cyan-600 hover:bg-gray-50 transition-colors',
                  currentModule === 'settings' && 'text-cyan-700 bg-cyan-50',
                )}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {isMobile && (
                <button
                  type="button"
                  onClick={onOpenModules}
                  className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                  aria-label="All modules"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={cn('flex-1 overflow-y-auto min-h-0', isMobile ? 'pb-24' : '')}>
        <div className="max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
