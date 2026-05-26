import React, { useState, useEffect } from 'react';

import { api, copyText, defaultExpiry } from '../api';



function Field({ label, hint, children, className = '' }) {

  return (

    <label className={`block ${className}`}>

      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>

      {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}

      <div className="mt-1">{children}</div>

    </label>

  );

}



const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 bg-white';



export default function IssuerForm({ onIssued }) {

  const [meta, setMeta] = useState(null);

  const [form, setForm] = useState({

    organisation: '',

    site_code: '',

    plan: 'professional',

    expires_at: defaultExpiry(),

    max_terminals: '10',

    notes: '',

  });

  const [modules, setModules] = useState({});

  const [generated, setGenerated] = useState(null);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');



  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));



  useEffect(() => {

    api.meta().then((m) => {

      setMeta(m);

      setModules(m.planModules?.professional || {});

    });

  }, []);



  async function loadPlanModules(plan) {

    const r = await api.planModules(plan);

    setModules(r.modules || {});

  }



  async function handlePlanChange(plan) {

    set('plan', plan);

    await loadPlanModules(plan);

  }



  async function generate() {

    setError('');

    if (!form.organisation.trim()) {

      setError('Organisation name is required');

      return;

    }

    setBusy(true);

    try {

      const r = await api.generate({

        organisation: form.organisation.trim(),

        site_code: form.site_code.trim() || undefined,

        plan: form.plan,

        expires_at: form.expires_at,

        max_terminals: parseInt(form.max_terminals, 10) || 10,

        modules,

        notes: form.notes.trim() || undefined,

      });

      setGenerated(r.package);

      onIssued?.(r.record);

    } catch (e) {

      setError(e.message || 'Generate failed');

    } finally {

      setBusy(false);

    }

  }



  async function copyKey() {

    await copyText(generated.licence_key);

  }



  async function copyJson() {

    await copyText(JSON.stringify(generated, null, 2));

  }



  async function copyLicenceFile() {

    await copyText(generated.licence_file);

  }



  function downloadLicenceFile() {

    const blob = new Blob([generated.licence_file], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    const slug = (generated.organisation || 'facility').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 32);

    a.href = url;

    a.download = `facilityos-${slug}.lic`;

    a.click();

    URL.revokeObjectURL(url);

  }



  async function copyCustomerEmail() {

    const text = [

      `FacilityOS licence — ${generated.organisation}`,

      '',

      `Plan: ${generated.plan}`,

      `Expires: ${generated.expires_at}`,

      `Max terminals: ${generated.max_terminals}`,

      '',

      'Modules: ' + (generated.moduleList?.join(', ') || ''),

      '',

      'Install the attached facilityos.lic file on your data server PC:',

      '',

      'Option A — Save file to:',

      '  %ProgramData%\\FacilityOS\\licence\\facilityos.lic',

      '  Then restart FacilityOS Server.',

      '',

      'Option B — Open FacilityOS → Settings → Licence → upload facilityos.lic',

      '',

      'Reference key: ' + generated.licence_key,

    ].join('\n');

    await copyText(text);

  }



  const moduleLabels = meta?.moduleLabels || {};



  return (

    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 space-y-5">

      <div>

        <h2 className="text-lg font-bold text-slate-900">Issue new licence</h2>

        <p className="text-sm text-slate-500 mt-1">Generate a signed certificate for a customer site. Saved to your local registry automatically.</p>

      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Field label="Organisation" hint="Customer / facility name">

          <input className={inputCls} value={form.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="EA Networks Centre" />

        </Field>

        <Field label="Site code" hint="Optional — embedded in key (max 8 chars)">

          <input className={inputCls} value={form.site_code} onChange={(e) => set('site_code', e.target.value)} placeholder="EANC" maxLength={8} />

        </Field>

        <Field label="Plan">

          <select className={inputCls} value={form.plan} onChange={(e) => handlePlanChange(e.target.value)}>

            {(meta?.plans || []).map((p) => (

              <option key={p.id} value={p.id}>{p.label}</option>

            ))}

          </select>

        </Field>

        <Field label="Expiry">

          <input type="date" className={inputCls} value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} />

        </Field>

        <Field label="Max terminals">

          <input type="number" min={1} className={inputCls} value={form.max_terminals} onChange={(e) => set('max_terminals', e.target.value)} />

        </Field>

        <Field label="Internal notes" hint="Optional — not sent to customer">

          <input className={inputCls} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Invoice #, contact, etc." />

        </Field>

      </div>



      <div>

        <div className="flex items-center justify-between mb-2">

          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modules</span>

          <button type="button" className="text-xs text-cyan-600 hover:text-cyan-800" onClick={() => loadPlanModules(form.plan)}>

            Reset to plan defaults

          </button>

        </div>

        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">

          {Object.entries(modules).map(([key, on]) => (

            <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">

              <input

                type="checkbox"

                checked={!!on}

                onChange={() => setModules((m) => ({ ...m, [key]: !m[key] }))}

                className="rounded border-slate-300 text-cyan-600"

              />

              <span>{moduleLabels[key] || key.replace('_', ' ')}</span>

            </label>

          ))}

        </div>

      </div>



      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}



      <button

        type="button"

        onClick={generate}

        disabled={busy || !form.organisation.trim()}

        className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-cyan-600 text-white font-semibold text-sm hover:bg-cyan-700 disabled:opacity-50 transition-colors"

      >

        {busy ? 'Signing…' : 'Generate signed licence'}

      </button>



      {generated && (

        <div className="border-t border-slate-100 pt-5 space-y-4">

          <div>

            <span className="text-xs font-semibold text-slate-500 uppercase">Signed licence file (send to customer)</span>

            <div className="mt-1 p-4 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-xs break-all text-emerald-950 max-h-40 overflow-y-auto whitespace-pre-wrap">

              {generated.licence_file}

            </div>

          </div>

          <div>

            <span className="text-xs font-semibold text-slate-500 uppercase">Reference key</span>

            <div className="mt-1 p-3 bg-cyan-50 border border-cyan-200 rounded-xl font-mono text-sm break-all text-cyan-950">

              {generated.licence_key}

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <ActionBtn onClick={downloadLicenceFile} primary>Download facilityos.lic</ActionBtn>

            <ActionBtn onClick={copyLicenceFile}>Copy licence file</ActionBtn>

            <ActionBtn onClick={copyKey}>Copy reference key</ActionBtn>

            <ActionBtn onClick={copyJson}>Copy JSON</ActionBtn>

            <ActionBtn onClick={copyCustomerEmail}>Copy customer email</ActionBtn>

          </div>

          <p className="text-xs text-slate-400">

            Ed25519 signed · Expires {generated.expires_at} · {generated.moduleList?.length} modules · {generated.max_terminals} terminals

          </p>

        </div>

      )}

    </div>

  );

}



function ActionBtn({ children, onClick, primary }) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${

        primary

          ? 'bg-slate-800 text-white hover:bg-slate-900'

          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'

      }`}

    >

      {children}

    </button>

  );

}

