// NZS 5826:2010 Compliance Ranges — matches AquaOps ComplianceUtils
export const NZS5826_LIMITS = {
  pool: {
    ph: { min: 7.2, max: 8.0 },
    free_chlorine: { min: 1.5, max: 5.0, unit: 'mg/L' },
    total_available_chlorine: { max: 5.5, unit: 'mg/L' },
    combined_chlorine: { max: 0.5, unit: 'mg/L' },
    temperature: { min: 24, max: 35, unit: '°C' },
    turbidity: { max: 0.5, unit: 'NTU' },
    total_alkalinity: { min: 80, max: 200, unit: 'mg/L' },
  },
  spa: {
    ph: { min: 7.2, max: 8.0 },
    free_chlorine: { min: 2.0, max: 5.0, unit: 'mg/L' },
    total_available_chlorine: { max: 5.5, unit: 'mg/L' },
    combined_chlorine: { max: 0.5, unit: 'mg/L' },
    temperature: { min: 36, max: 40, unit: '°C' },
    turbidity: { max: 0.5, unit: 'NTU' },
    total_alkalinity: { min: 80, max: 200, unit: 'mg/L' },
  },
};

export const getEffectiveLimits = (poolType = 'pool', customLimits = null) => {
  if (customLimits && typeof customLimits === 'string') {
    try { customLimits = JSON.parse(customLimits); } catch { customLimits = {}; }
  }
  customLimits = customLimits || {};
  const baseType = poolType === 'spa' ? 'spa' : 'pool';
  const defaults = NZS5826_LIMITS[baseType] || NZS5826_LIMITS.pool;
  const effective = {};
  Object.keys(defaults).forEach(p => {
    effective[p] = { ...defaults[p] };
    if (customLimits[`${p}_min`] != null) effective[p].min = customLimits[`${p}_min`];
    if (customLimits[`${p}_max`] != null) effective[p].max = customLimits[`${p}_max`];
  });
  effective.total_available_chlorine.max = effective.free_chlorine.max + effective.combined_chlorine.max;
  delete effective.total_available_chlorine.min;
  return effective;
};

export const checkParam = (param, value, poolType = 'pool', customLimits = {}) => {
  if (value === null || value === undefined || value === '') return null;
  const lim = getEffectiveLimits(poolType, customLimits)[param];
  if (!lim) return null;
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  if (lim.min !== undefined && lim.max !== undefined) return v >= lim.min && v <= lim.max;
  if (lim.max !== undefined) return v <= lim.max;
  if (lim.min !== undefined) return v >= lim.min;
  return true;
};

export const checkOverallCompliance = (test, poolType = 'pool', customLimits = {}) => {
  for (const p of ['free_chlorine', 'ph']) {
    if (checkParam(p, test[p], poolType, customLimits) === false) return false;
  }
  if (test.total_available_chlorine && test.free_chlorine) {
    const cac = parseFloat((test.total_available_chlorine - test.free_chlorine).toFixed(3));
    if (checkParam('combined_chlorine', cac, poolType, customLimits) === false) return false;
  }
  for (const p of ['temperature', 'turbidity']) {
    if (test[p] != null && test[p] !== '') {
      if (checkParam(p, test[p], poolType, customLimits) === false) return false;
    }
  }
  return true;
};

export const formatLimit = (param, poolType = 'pool', customLimits = {}) => {
  const lim = getEffectiveLimits(poolType, customLimits)[param];
  if (!lim) return '';
  const u = lim.unit ? ` ${lim.unit}` : '';
  if (lim.min !== undefined && lim.max !== undefined) return `${lim.min}–${lim.max}${u}`;
  if (lim.max !== undefined) return `≤${lim.max}${u}`;
  if (lim.min !== undefined) return `≥${lim.min}${u}`;
  return '';
};

export const getScheduledTimes = (poolType, testDate) => {
  const d = new Date(testDate);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  if (poolType === 'spa') {
    return isWeekend
      ? ['06:30','08:30','10:30','12:30','14:30','16:30']
      : ['05:30','07:30','09:30','11:30','13:30','15:30','17:30','19:30'];
  }
  return isWeekend ? ['06:30','10:00','13:00','16:00'] : ['05:45','09:00','12:00','15:00','18:00'];
};
