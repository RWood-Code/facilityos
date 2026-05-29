import React, { useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Btn, Select, Field } from './ui';
import { downloadCsv, parseCsv } from '../utils/download';
import { CSV_MODULES } from '../../shared/csvTemplates.js';

export default function DataImportPanel() {
  const { toast } = useAppStore();
  const [moduleKey, setModuleKey] = useState('pools');
  const [busy, setBusy] = useState(false);

  const modules = Object.entries(CSV_MODULES).map(([key, m]) => ({ key, label: m.label }));

  async function downloadTemplate() {
    try {
      const r = await dbQuery('import:template', { module: moduleKey });
      downloadCsv(r);
      toast(`Downloaded ${r.filename}`);
    } catch (e) {
      toast(e.message || 'Could not download template', 'error');
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        toast('CSV has no data rows', 'warn');
        return;
      }
      const r = await dbQuery('import:csv', { module: moduleKey, rows });
      const skipped = r.skipped ? ` (${r.skipped} skipped)` : '';
      toast(`Imported ${r.imported} ${CSV_MODULES[moduleKey]?.label || moduleKey} record(s)${skipped}`);
    } catch (err) {
      toast(err.message || 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const mod = CSV_MODULES[moduleKey];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Import existing data (CSV)</h3>
        <p className="text-xs text-gray-500 mt-1">
          Download a template, fill in your existing records, then import. Pool and asset names in CSV must match for linked imports (tests, work orders, etc.).
        </p>
      </div>

      <Field label="Module">
        <Select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)}>
          {modules.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </Select>
      </Field>

      {mod && (
        <p className="text-xs text-gray-500">
          Columns: {mod.headers.join(', ')}
          {mod.required?.length ? ` · Required: ${mod.required.join(', ')}` : ''}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Btn variant="secondary" size="sm" onClick={downloadTemplate}>Download template</Btn>
        <label className="inline-flex items-center justify-center text-sm font-medium px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer disabled:opacity-50">
          {busy ? 'Importing…' : 'Choose CSV file…'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
      </div>
    </div>
  );
}
