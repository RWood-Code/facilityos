/**
 * Licence plan → module entitlements (single source of truth for server + docs).
 * UI reads effective access from licence:status.modules — do not duplicate checks in React.
 */

const ALL_MODULE_KEYS = [
  'pools',
  'dosing',
  'closures',
  'steam',
  'workorders',
  'schedules',
  'staff',
  'assets',
  'reports',
  'rostering',
  'manager_dashboard',
  'iltp_poolsafe',
];

/** Maps licence module key → facility setting key */
const MODULE_TO_SETTING = {
  pools: 'show_pools',
  dosing: 'show_dosing',
  closures: 'show_closures',
  steam: 'show_steam',
  workorders: 'show_work_orders',
  schedules: 'show_maintenance',
  staff: 'show_staff',
  assets: 'show_assets',
  reports: 'show_reports',
  rostering: 'show_rostering',
  manager_dashboard: 'show_manager_dashboard',
  iltp_poolsafe: 'show_iltp_poolsafe',
};

/** Maps module registry id → licence module key */
const MODULE_ID_TO_LICENCE = {
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

const PLAN_ENTITLEMENTS = {
  trial: ['pools', 'dosing', 'closures', 'steam', 'workorders', 'schedules', 'staff', 'assets', 'reports', 'iltp_poolsafe'],
  standard: ['pools', 'dosing', 'closures', 'steam', 'workorders', 'schedules', 'staff', 'assets', 'reports', 'iltp_poolsafe'],
  professional: ['pools', 'dosing', 'closures', 'steam', 'workorders', 'schedules', 'staff', 'assets', 'reports', 'rostering', 'manager_dashboard', 'iltp_poolsafe'],
  enterprise: ALL_MODULE_KEYS,
  /** Hosted relay tier — same modules as professional + cloud sync (enforced via cloud_enabled setting) */
  cloud: ['pools', 'dosing', 'closures', 'steam', 'workorders', 'schedules', 'staff', 'assets', 'reports', 'rostering', 'manager_dashboard'],
};

const PLAN_LABELS = {
  trial: 'Trial',
  standard: 'Standard',
  professional: 'Professional',
  enterprise: 'Enterprise',
  cloud: 'Cloud',
};

/** Channel prefix → licence module (server enforcement) */
const CHANNEL_MODULE_PREFIXES = [
  ['tests:', 'pools'],
  ['pools:', 'pools'],
  ['closures:', 'pools'],
  ['dosing:', 'dosing'],
  ['steamchecks:', 'steam'],
  ['workorders:', 'workorders'],
  ['schedules:', 'schedules'],
  ['staff:', 'staff'],
  ['qualifications:', 'staff'],
  ['import:staff', 'staff'],
  ['import:csv', null],
  ['import:template', null],
  ['export:staff', 'staff'],
  ['assets:', 'assets'],
  ['reports:', 'reports'],
  ['saved_reports:', 'reports'],
  ['export:tests', 'reports'],
  ['roster:', 'rostering'],
  ['export:roster', 'rostering'],
  ['export:payroll', 'rostering'],
  ['notifications:', 'iltp_poolsafe'],
  ['budget:', 'schedules'],
  ['iltp:', 'iltp_poolsafe'],
  ['poolsafe_audits:', 'iltp_poolsafe'],
  ['poolsafe_docs:', 'iltp_poolsafe'],
  ['training_records:', 'staff'],
];

function getPlanModules(plan) {
  const entitled = PLAN_ENTITLEMENTS[plan] || PLAN_ENTITLEMENTS.standard;
  const modules = {};
  ALL_MODULE_KEYS.forEach((key) => {
    modules[key] = entitled.includes(key);
  });
  return modules;
}

function applyFeatureOverrides(modules, featuresJson) {
  if (!featuresJson) return modules;
  try {
    const overrides = typeof featuresJson === 'string' ? JSON.parse(featuresJson) : featuresJson;
    if (overrides && typeof overrides === 'object') {
      Object.entries(overrides).forEach(([key, enabled]) => {
        if (ALL_MODULE_KEYS.includes(key)) modules[key] = !!enabled;
      });
    }
  } catch {
    /* ignore invalid JSON */
  }
  return modules;
}

function resolveModuleAccess(plan, featuresJson) {
  return applyFeatureOverrides(getPlanModules(plan || 'standard'), featuresJson);
}

async function syncSettingsFromModules(run, modules) {
  for (const [modKey, settingKey] of Object.entries(MODULE_TO_SETTING)) {
    await run(`INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)`, [
      settingKey,
      modules[modKey] ? '1' : '0',
    ]);
  }
  const registryKeys = {
    rostering: 'rostering',
    dosing: 'dosing',
    steam: 'steam',
    closures: 'closures',
  };
  for (const [modKey, registryKey] of Object.entries(registryKeys)) {
    if (modules[modKey] != null) {
      await run(`UPDATE module_registry SET enabled=? WHERE module_key=?`, [modules[modKey] ? 1 : 0, registryKey]);
    }
  }
}

function channelRequiresModule(channel) {
  for (const [prefix, modKey] of CHANNEL_MODULE_PREFIXES) {
    if (channel === prefix || channel.startsWith(prefix)) return modKey;
  }
  return null;
}

function isChannelAllowed(channel, modules) {
  const modKey = channelRequiresModule(channel);
  if (!modKey) return true;
  return modules[modKey] !== false;
}

function getLicenceKeyForModuleId(moduleId) {
  return MODULE_ID_TO_LICENCE[moduleId] ?? null;
}

module.exports = {
  ALL_MODULE_KEYS,
  MODULE_TO_SETTING,
  MODULE_ID_TO_LICENCE,
  PLAN_ENTITLEMENTS,
  PLAN_LABELS,
  getPlanModules,
  resolveModuleAccess,
  syncSettingsFromModules,
  channelRequiresModule,
  isChannelAllowed,
  getLicenceKeyForModuleId,
};
