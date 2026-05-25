import React, { useState, useEffect } from 'react';
import { dbQuery } from '../hooks/useDb';
import { Btn, Field, Input, Select } from './ui';

const DEFAULT_MODULES = {
  pools: true,
  dosing: true,
  closures: true,
  steam: true,
  workorders: true,
  schedules: true,
  staff: true,
  assets: true,
  reports: true,
  rostering: true,
  manager_dashboard: true,
};

function defaultExpiry() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function LicenceGenerator({ onApplied }) {
  const [form, setForm] = useState({
    organisation: '',
    site_code: '',
    plan: 'professional',
    expires_at: defaultExpiry(),
    max_terminals: '10',
  });
  const [moduleLabels, setModuleLabels] = useState({});
  const [modules, setModules] = useState({ ...DEFAULT_MODULES });
  const [generated, setGenerated] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dbQuery('licence:plans').then((r) => {
      if (r?.moduleLabels) setModuleLabels(r.moduleLabels);
    });
    loadPlanModules(form.plan);
  }, []);

  async function loadPlanModules(plan) {
    const r = await dbQuery('licence:plan_modules', { plan });
    if (r?.modules) setModules({ ...r.modules });
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handlePlanChange(plan) {
    set('plan', plan);
    await loadPlanModules(plan);
  }

  function toggleModule(key) {
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  async function generate() {
    if (!form.organisation.trim()) return;
    setBusy(true);
    try {
      const pkg = await dbQuery('licence:generate', {
        organisation: form.organisation.trim(),
        site_code: form.site_code.trim() || undefined,
        plan: form.plan,
        expires_at: form.expires_at,
        max_terminals: parseInt(form.max_terminals, 10) || 10,
        modules,
      });
      setGenerated(pkg);
    } finally {
      setBusy(false);
    }
  }

  async function applyToThisSite() {
    if (!generated) return;
    setBusy(true);
    try {
      await dbQuery('licence:activate', {
        licence_key: generated.licence_key,
        expires_at: generated.expires_at,
        organisation: generated.organisation,
        plan: generated.plan,
        max_terminals: generated.max_terminals,
        modules: generated.modules,
      });
      onApplied?.(generated);
    } finally {
      setBusy(false);
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Licence issuer</h3>
        <p className="text-xs text-gray-500 mt-1">
          Generate customer licence keys and choose modules. Apply directly to this installation or copy for another site.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Organisation">
          <Input value={form.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="Customer name" />
        </Field>
        <Field label="Site code (optional)">
          <Input value={form.site_code} onChange={(e) => set('site_code', e.target.value)} placeholder="EANC" maxLength={8} />
        </Field>
        <Field label="Plan">
          <Select value={form.plan} onChange={(e) => handlePlanChange(e.target.value)}>
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
            <option value="cloud">Cloud (hosted relay)</option>
          </Select>
        </Field>
        <Field label="Expiry">
          <Input type="date" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} />
        </Field>
        <Field label="Max terminals">
          <Input type="number" min="1" value={form.max_terminals} onChange={(e) => set('max_terminals', e.target.value)} />
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Module chooser</label>
          <button type="button" className="text-xs text-cyan-600" onClick={() => loadPlanModules(form.plan)}>
            Reset to plan defaults
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
          {Object.entries(modules).map(([key, on]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!on} onChange={() => toggleModule(key)} className="rounded border-gray-300" />
              <span>{moduleLabels[key] || key.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn onClick={generate} disabled={busy || !form.organisation.trim()}>
          {busy ? 'Working…' : 'Generate licence key'}
        </Btn>
      </div>

      {generated && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Generated key</label>
            <div className="mt-1 p-3 bg-cyan-50 border border-cyan-200 rounded-lg font-mono text-sm break-all">
              {generated.licence_key}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="secondary" size="sm" onClick={() => copy(generated.licence_key)}>Copy key</Btn>
            <Btn variant="secondary" size="sm" onClick={() => copy(JSON.stringify(generated, null, 2))}>Copy JSON</Btn>
            <Btn size="sm" onClick={applyToThisSite} disabled={busy}>Apply to this installation</Btn>
          </div>
          <p className="text-xs text-gray-400">
            Enabled: {generated.moduleList?.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
