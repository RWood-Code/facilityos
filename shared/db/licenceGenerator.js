const { ALL_MODULE_KEYS, PLAN_ENTITLEMENTS, getPlanModules } = require('./entitlements');

const PLAN_CODES = {
  trial: 'TRIAL',
  standard: 'STD',
  professional: 'PRO',
  enterprise: 'ENT',
};

const MODULE_LABELS = {
  pools: 'Pool Management',
  dosing: 'Dosing Calculator',
  closures: 'Pool Closures',
  steam: 'Steam & Sauna',
  workorders: 'Work Orders',
  schedules: 'Maintenance',
  staff: 'Staff',
  assets: 'Assets',
  reports: 'Reports & Analytics',
  rostering: 'Staff Rostering',
  manager_dashboard: 'Manager View',
};

function slugCode(text, maxLen = 8) {
  return String(text || 'SITE')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, maxLen)
    .toUpperCase() || 'SITE';
}

function generateLicenceKey({ organisation, siteCode, plan } = {}) {
  const planCode = PLAN_CODES[plan] || PLAN_CODES.standard;
  const site = slugCode(siteCode || organisation);
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FACILITYOS-${planCode}-${site}-${year}-${suffix}`;
}

function defaultExpiryDate(years = 1) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function modulesFromPlan(plan) {
  return getPlanModules(plan || 'standard');
}

function normalizeModuleSelection(plan, selection = {}) {
  const base = modulesFromPlan(plan);
  const modules = {};
  ALL_MODULE_KEYS.forEach((key) => {
    modules[key] = selection[key] != null ? !!selection[key] : base[key];
  });
  return modules;
}

function featuresFromModules(plan, modules) {
  const base = modulesFromPlan(plan);
  const features = {};
  let hasOverride = false;
  ALL_MODULE_KEYS.forEach((key) => {
    if (modules[key] !== base[key]) {
      features[key] = !!modules[key];
      hasOverride = true;
    }
  });
  return hasOverride ? features : null;
}

function buildLicencePackage({
  organisation,
  siteCode,
  plan = 'professional',
  expires_at,
  max_terminals = 10,
  modules: moduleSelection,
} = {}) {
  const modules = normalizeModuleSelection(plan, moduleSelection);
  const licence_key = generateLicenceKey({ organisation, siteCode, plan });
  const expiresAt = expires_at || defaultExpiryDate(1);
  const features = featuresFromModules(plan, modules);

  return {
    licence_key,
    organisation: organisation || null,
    plan,
    expires_at: expiresAt,
    max_terminals,
    features,
    modules,
    moduleList: ALL_MODULE_KEYS.filter((k) => modules[k]),
    instructions: [
      'Open FacilityOS on the data server PC',
      'Go to Settings → Licence',
      'Enter the licence key, plan, and expiry (or paste the JSON package)',
      'Click Activate — modules sync automatically from the package',
    ],
  };
}

module.exports = {
  MODULE_LABELS,
  PLAN_CODES,
  generateLicenceKey,
  defaultExpiryDate,
  modulesFromPlan,
  normalizeModuleSelection,
  featuresFromModules,
  buildLicencePackage,
};
