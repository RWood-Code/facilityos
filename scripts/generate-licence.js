#!/usr/bin/env node
/**
 * FacilityOS licence key generator (CLI)
 *
 * Usage:
 *   node scripts/generate-licence.js --org "EA Networks Centre" --plan professional
 *   node scripts/generate-licence.js --org "Gym Pool" --plan standard --years 2 --terminals 5
 *   node scripts/generate-licence.js --org "Demo" --plan professional --modules rostering,manager_dashboard
 */
const { buildLicencePackage, MODULE_LABELS } = require('../shared/db/licenceGenerator');
const { ALL_MODULE_KEYS } = require('../shared/db/entitlements');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--org') args.org = argv[++i];
    else if (a === '--site') args.site = argv[++i];
    else if (a === '--plan') args.plan = argv[++i];
    else if (a === '--years') args.years = Number(argv[++i]);
    else if (a === '--expiry') args.expiry = argv[++i];
    else if (a === '--terminals') args.terminals = Number(argv[++i]);
    else if (a === '--modules') args.modules = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function modulesFromCsv(csv, plan) {
  const pkg = buildLicencePackage({ organisation: 'x', plan });
  const selection = {};
  const enabled = new Set(csv.split(',').map((s) => s.trim()).filter(Boolean));
  ALL_MODULE_KEYS.forEach((key) => {
    selection[key] = enabled.has(key);
  });
  return selection;
}

function printHelp() {
  console.log(`
FacilityOS Licence Generator

Options:
  --org "Customer Name"     Organisation name (required)
  --site CODE               Site code for key (default: org slug)
  --plan PLAN               trial | standard | professional | enterprise (default: professional)
  --years N                 Expiry in years from today (default: 1)
  --expiry YYYY-MM-DD       Explicit expiry (overrides --years)
  --terminals N             Max terminals (default: 10)
  --modules a,b,c           Comma list of enabled modules (overrides plan defaults)
  --json                    Output JSON only

Modules: ${ALL_MODULE_KEYS.join(', ')}
`);
}

const args = parseArgs(process.argv);
if (args.help || !args.org) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const expires_at = args.expiry || (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + (args.years || 1));
  return d.toISOString().slice(0, 10);
})();

const moduleSelection = args.modules ? modulesFromCsv(args.modules, args.plan || 'professional') : undefined;

const pkg = buildLicencePackage({
  organisation: args.org,
  siteCode: args.site,
  plan: args.plan || 'professional',
  expires_at,
  max_terminals: args.terminals || 10,
  modules: moduleSelection,
});

if (args.json) {
  console.log(JSON.stringify(pkg, null, 2));
  process.exit(0);
}

console.log('\n=== FacilityOS Licence ===\n');
console.log(`Licence key:    ${pkg.licence_key}`);
console.log(`Organisation:   ${pkg.organisation || args.org}`);
console.log(`Plan:           ${pkg.plan}`);
console.log(`Expires:        ${pkg.expires_at}`);
console.log(`Max terminals:  ${pkg.max_terminals}`);
console.log('\nEnabled modules:');
pkg.moduleList.forEach((k) => console.log(`  ✓ ${MODULE_LABELS[k] || k}`));
console.log('\nCustomer activation steps:');
pkg.instructions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
console.log('\nJSON (save to CRM):\n');
console.log(JSON.stringify(pkg, null, 2));
console.log('');
