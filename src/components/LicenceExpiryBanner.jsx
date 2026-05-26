import React from 'react';
import { useAppStore } from '../store/appStore';
import { useLicenceCountdown } from '../hooks/useLicenceCountdown';
import {
  shouldShowExpiryBanner,
  expiryBannerUrgent,
} from '../utils/licenceExpiry';
import { Btn } from './ui';

export default function LicenceExpiryBanner() {
  const { licence, setModule } = useAppStore();
  const countdown = useLicenceCountdown(licence?.expires_at);

  if (!shouldShowExpiryBanner(licence)) return null;

  const isTrial = licence.isTrial || licence.plan === 'trial';
  const urgent = expiryBannerUrgent(licence, countdown);
  const title = isTrial ? 'Evaluation trial' : licence.inGrace ? 'Licence expired' : 'Licence expiring soon';

  function openLicenceSettings() {
    try { sessionStorage.setItem('facilityos_settings_tab', 'licence'); } catch { /* ignore */ }
    setModule('settings');
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100] shadow-lg border-b ${
        urgent
          ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 border-red-800 text-white'
          : 'bg-gradient-to-r from-cyan-700 via-cyan-600 to-teal-600 border-cyan-900 text-white'
      }`}
    >
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-3 md:gap-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-2xl flex-shrink-0 animate-pulse" aria-hidden>{isTrial ? '⏳' : '⚠️'}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm md:text-base tracking-tight">{title}</p>
            <p className="text-xs md:text-sm text-white/90 mt-0.5">
              {countdown.expired
                ? `Expired ${countdown.label} — activate a licence to keep using FacilityOS`
                : `Expires ${licence.expires_at.slice(0, 10)} · activate or renew before time runs out`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`rounded-xl px-4 py-2 text-center min-w-[9.5rem] ${
            urgent ? 'bg-black/25 ring-2 ring-white/40' : 'bg-black/20 ring-1 ring-white/30'
          }`}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-white/80 mb-0.5">
              {countdown.expired ? 'Expired' : 'Time remaining'}
            </p>
            <p className="font-mono text-xl md:text-2xl font-bold tabular-nums tracking-tight leading-none">
              {countdown.expired ? '00:00:00' : countdown.label}
            </p>
          </div>
          <Btn
            size="sm"
            className={urgent
              ? 'bg-white text-red-700 hover:bg-red-50 border-0 font-semibold'
              : 'bg-white text-cyan-800 hover:bg-cyan-50 border-0 font-semibold'}
            onClick={openLicenceSettings}
          >
            {isTrial ? 'Enter licence key' : 'Renew licence'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** Layout spacer — match fixed banner height so content is not hidden underneath. */
export function LicenceExpiryBannerSpacer() {
  const { licence } = useAppStore();
  if (!shouldShowExpiryBanner(licence)) return null;
  return <div className="h-[4.75rem] flex-shrink-0" aria-hidden />;
}
