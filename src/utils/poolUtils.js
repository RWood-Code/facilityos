/** Pool type helpers — spa uses water tests; steam room & sauna use hygiene checks only. */

export const POOL_TYPES = {
  pool: { label: 'Pool', icon: '🏊', waterTests: true, steamCheck: false },
  spa: { label: 'Spa pool', icon: '♨️', waterTests: true, steamCheck: false },
  steam_room: { label: 'Steam room', icon: '💨', waterTests: false, steamCheck: true },
  sauna: { label: 'Sauna', icon: '🔥', waterTests: false, steamCheck: true },
};

export function isWaterTestPool(type) {
  return type === 'pool' || type === 'spa';
}

export function isSteamCheckArea(type) {
  return type === 'steam_room' || type === 'sauna';
}

export function getPoolTypeMeta(type) {
  return POOL_TYPES[type] || POOL_TYPES.pool;
}

export function parseCustomLimits(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export const LIMIT_PARAM_KEYS = [
  { key: 'free_chlorine', label: 'Free Chlorine (FAC)', unit: 'mg/L' },
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU' },
  { key: 'total_alkalinity', label: 'Total Alkalinity', unit: 'mg/L' },
  { key: 'combined_chlorine', label: 'Combined Chlorine (CAC)', unit: 'mg/L' },
];

export function limitsToForm(customLimits) {
  const lim = parseCustomLimits(customLimits);
  const form = { useCustom: Object.keys(lim).length > 0 };
  LIMIT_PARAM_KEYS.forEach(({ key }) => {
    form[`${key}_min`] = lim[`${key}_min`] ?? '';
    form[`${key}_max`] = lim[`${key}_max`] ?? '';
  });
  return form;
}

export function formToLimits(limitForm) {
  if (!limitForm.useCustom) return null;
  const out = {};
  LIMIT_PARAM_KEYS.forEach(({ key }) => {
    const min = limitForm[`${key}_min`];
    const max = limitForm[`${key}_max`];
    if (min !== '' && min != null) out[`${key}_min`] = parseFloat(min);
    if (max !== '' && max != null) out[`${key}_max`] = parseFloat(max);
  });
  return Object.keys(out).length ? out : null;
}
