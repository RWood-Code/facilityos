const pad = (n) => String(n).padStart(2, '0');

/** Live countdown parts from an ISO/local expiry timestamp. */
export function getExpiryCountdown(expiresAt) {
  if (!expiresAt) return { expired: true, label: 'Expired', ms: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) {
    const overdue = Math.abs(ms);
    const days = Math.floor(overdue / 86400000);
    const hours = Math.floor((overdue % 86400000) / 3600000);
    const minutes = Math.floor((overdue % 3600000) / 60000);
    const seconds = Math.floor((overdue % 60000) / 1000);
    const label = days > 0
      ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)} ago`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ago`;
    return { expired: true, label, ms, days, hours, minutes, seconds };
  }

  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const label = days > 0
    ? `${days} day${days === 1 ? '' : 's'} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return { expired: false, label, ms, days, hours, minutes, seconds };
}

export const TRIAL_DAYS = 7;

export const EXPIRY_BANNER_DAYS = 7;

/** Show the prominent expiry banner when trial or within EXPIRY_BANNER_DAYS of expiry. */
export function shouldShowExpiryBanner(licence) {
  if (!licence?.valid || !licence?.expires_at) return false;
  if (licence.inGrace) return true;
  const isTrial = licence.isTrial || licence.plan === 'trial';
  if (isTrial) return true;
  return licence.daysRemaining <= EXPIRY_BANNER_DAYS;
}

export function expiryBannerUrgent(licence, countdown) {
  if (!licence) return false;
  return countdown?.expired || licence.daysRemaining <= 1 || (countdown?.days === 0 && countdown?.hours < 24);
}
