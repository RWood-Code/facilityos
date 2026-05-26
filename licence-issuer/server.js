const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  buildLicencePackage,
  MODULE_LABELS,
  modulesFromPlan,
} = require('../shared/db/licenceGenerator');
const { PLAN_LABELS, ALL_MODULE_KEYS } = require('../shared/db/entitlements');
const { listIssued, addIssued, removeIssued, setDataDir, getDataDir } = require('./server/registry');

const DEFAULT_PORT = 3920;

function createIssuerApp(distDir) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'FacilityOS Licence Issuer', registry: getDataDir() });
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      plans: Object.entries(PLAN_LABELS).map(([id, label]) => ({ id, label })),
      moduleLabels: MODULE_LABELS,
      allModules: ALL_MODULE_KEYS,
      planModules: Object.fromEntries(
        ['trial', 'standard', 'professional', 'enterprise', 'cloud'].map((p) => [p, modulesFromPlan(p)])
      ),
    });
  });

  app.get('/api/plan-modules', (req, res) => {
    const plan = req.query.plan || 'professional';
    res.json({ plan, modules: modulesFromPlan(plan) });
  });

  app.post('/api/generate', (req, res) => {
    const {
      organisation,
      site_code: siteCode,
      plan,
      expires_at,
      max_terminals,
      modules,
      notes,
    } = req.body || {};

    if (!organisation || !String(organisation).trim()) {
      return res.status(400).json({ ok: false, error: 'organisation required' });
    }

    const pkg = buildLicencePackage({
      organisation: String(organisation).trim(),
      siteCode: siteCode ? String(siteCode).trim() : undefined,
      plan: plan || 'professional',
      expires_at,
      max_terminals: max_terminals != null ? Number(max_terminals) : 10,
      modules,
    });

    pkg.site_code = siteCode ? String(siteCode).trim() : null;
    pkg.instructions = [
      'Open FacilityOS on the customer data server PC',
      'If licence expired: click Administrator → activate licence on the gate screen',
      'Otherwise: Settings → Licence → enter key, plan, and expiry',
      'Click Activate — modules sync automatically from the package',
    ];

    const record = addIssued(pkg, notes);
    res.json({ ok: true, package: pkg, record });
  });

  app.get('/api/issued', (_req, res) => {
    res.json({ ok: true, records: listIssued() });
  });

  app.delete('/api/issued/:id', (req, res) => {
    res.json({ ok: true, ...removeIssued(req.params.id) });
  });

  if (distDir && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const index = path.join(distDir, 'index.html');
      if (fs.existsSync(index)) res.sendFile(index);
      else next();
    });
  }

  return app;
}

function startIssuerServer(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const distDir = options.distDir || path.join(__dirname, 'dist');
  if (options.dataDir) setDataDir(options.dataDir);

  const app = createIssuerApp(distDir);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`[licence-issuer] http://127.0.0.1:${port}`);
      console.log(`[licence-issuer] Registry: ${getDataDir()}`);
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startIssuerServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createIssuerApp, startIssuerServer, DEFAULT_PORT };
