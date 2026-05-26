/** Client-side module access — licence caps features; settings toggle within licensed set. */

const MODULE_LICENCE_KEYS = {
  dashboard: null,
  profile: null,
  settings: null,
  pools: 'pools',
  poolhistory: 'pools',
  dosing: 'dosing',
  closures: 'closures',
  steam: 'steam',
  workorders: 'workorders',
  schedules: 'schedules',
  rostering: 'rostering',
  staff: 'staff',
  assets: 'assets',
  reports: 'reports',
  managerdashboard: 'manager_dashboard',
  iltp: 'iltp_poolsafe',
};

export function getLicenceKey(moduleId, mod) {
  return mod?.licenceKey ?? MODULE_LICENCE_KEYS[moduleId] ?? null;
}

export function isModuleLicensed(mod, licence) {
  const key = getLicenceKey(mod.id, mod);
  if (!key) return true;
  if (!licence?.modules) return true;
  return licence.modules[key] !== false;
}

export function isModuleEnabledBySettings(mod, settings) {
  if (mod.alwaysOn) return true;
  if (!mod.settingKey) return true;
  return settings[mod.settingKey] !== '0';
}

export function isModuleAccessible(mod, settings, licence) {
  if (mod.alwaysOn) return true;
  if (!isModuleLicensed(mod, licence)) return false;
  return isModuleEnabledBySettings(mod, settings);
}

export function getModuleBlockReason(mod, settings, licence) {
  if (!isModuleLicensed(mod, licence)) {
    return `Not included in your ${licence?.planLabel || licence?.plan || 'current'} plan`;
  }
  if (!isModuleEnabledBySettings(mod, settings)) {
    return 'Disabled in facility settings';
  }
  return null;
}
