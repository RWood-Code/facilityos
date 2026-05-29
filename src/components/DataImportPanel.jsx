import React, { useState, useEffect } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Btn, Select, Field } from './ui';
import { downloadCsv, parseCsv } from '../utils/download';

const MODULE_OPTIONS = [
  { key: 'pools', label: 'Pools' },
  { key: 'staff', label: 'Staff' },
  { key: 'assets', label: 'Assets' },
  { key: 'workorders', label: 'Work orders' },
  { key: 'schedules', label: 'Maintenance schedules' },
  { key: 'tests', label: 'Water tests' },
  { key: 'closures', label: 'Pool closures' },
  { key: 'steamchecks', label: 'Steam room checks' },
];

export default function DataImportPanel() {
  const { toast } = useAppStore();
  const [moduleKey, setModuleKey] = useState('pools');
  const [busy, setBusy] = useState(false);
  const [headers, setHeaders] = useState([]);

  useEffect(() => {
    dbQuery('import:template', { module: moduleKey })
      .then((r) => setHeaders(r.headers || []))
      .catch(() => setHeaders([]));
  }, [moduleKey]);

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
      const label = MODULE_OPTIONS.find((m) => m.key === moduleKey)?.label || moduleKey;
      toast(`Imported ${r.imported} ${label} record(s)${skipped}`);
    } catch (err) {
      toast(err.message || 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  }

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
          {MODULE_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </Select>
      </Field>

      {headers.length > 0 && (
        <p className="text-xs text-gray-500">
          Columns: {headers.join(', ')}
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
