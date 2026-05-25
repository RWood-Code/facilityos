import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, Btn, Field, Input, Select, TabBar } from '../../components/ui';
import { MODULE_REGISTRY } from '../../config/modules';
import { downloadCsv, parseCsv } from '../../utils/download';
import { listBackups, createBackup, restoreBackup, checkIntegrity, formatBytes } from '../../utils/serverApi';
import CustomLimitsEditor from '../../components/CustomLimitsEditor';
import { limitsToForm, formToLimits } from '../../utils/poolUtils';

export default function Settings() {
  const { toast, setSettings, settings } = useAppStore();
  const [local, setLocal] = useState({});
  const [pools, setPools] = useState([]);
  const [tab, setTab] = useState('facility');
  const [poolForm, setPoolForm] = useState(false);
  const [editPool, setEditPool] = useState(null);
  const [terminalConfig, setTerminalConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [licence, setLicence] = useState(null);
  const [licForm, setLicForm] = useState({ key: '', expiry: '', days: '365' });
  const [backups, setBackups] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);

    try {
      const data = await listBackups();
      setBackups(data || []);
    } catch {
      setBackups([]);
    }
  }

  async function refreshIntegrity() {
    try {
      const data = await checkIntegrity();
      setIntegrity(data);
    } catch (e) {
      setIntegrity({ ok: false, messages: [e.message] });
    }
  }

  async function refreshAuditLog() {
    try {
      const rows = await dbQuery('audit:list', { limit: 20 });
      setAuditLog(rows || []);
    } catch {
      setAuditLog([]);
    }
  }

  useEffect(() => {
    Promise.all([dbQuery('settings:all'), dbQuery('pools:list')]).then(([s, p]) => {
      setLocal(s || {});
      setPools(p || []);
    });
    dbQuery('licence:status').then(setLicence).catch(() => {});
    if (window.facilityos) {
      window.facilityos.getConfig().then(setTerminalConfig);
      window.facilityos.checkHealth().then(setHealth);
    }
  }, []);

  useEffect(() => {
    if (tab === 'data') {
      refreshBackups();
      refreshIntegrity();
      refreshAuditLog();
    }
  }, [tab, terminalConfig?.serverUrl]);

  const set = (k, v) => setLocal((l) => ({ ...l, [k]: v }));

  async function saveSettings() {
    for (const [k, v] of Object.entries(local)) {
      await dbQuery('settings:set', { key: k, value: String(v) });
    }
    setSettings(local);
    toast('Settings saved');
  }

  async function saveTerminalConfig() {
    if (!window.facilityos || !terminalConfig) return;
    await window.facilityos.setConfig(terminalConfig);
    const h = await window.facilityos.checkHealth();
    setHealth(h);
    toast('Terminal connection saved — restart app if server role changed', 'info');
  }

  async function backupDatabase() {
    setBackupBusy(true);
    try {
      const data = await createBackup({
        terminalId: terminalConfig?.terminalId || local.terminal_id,
        actor: 'admin',
      });
      toast(`Backup saved: ${data.filename}`);
      await refreshBackups();
      await refreshAuditLog();
    } catch (e) {
      toast(e.message || 'Backup failed — is this the data server PC?', 'error');
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreFromBackup(filename) {
    if (!window.confirm(`Restore database from "${filename}"?\n\nA pre-restore backup will be created automatically.`)) return;
    setBackupBusy(true);
    try {
      await restoreBackup(filename, {
        terminalId: terminalConfig?.terminalId || local.terminal_id,
        actor: 'admin',
      });
      toast('Database restored — reload the app to refresh all data', 'info');
      await refreshBackups();
      await refreshIntegrity();
      await refreshAuditLog();
    } catch (e) {
      toast(e.message || 'Restore failed', 'error');
    } finally {
      setBackupBusy(false);
    }
  }

  const moduleToggles = MODULE_REGISTRY.filter((m) => m.settingKey && !m.alwaysOn).map((m) => [
    m.settingKey,
    m.label,
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Facility configuration, terminals, and modules"
        actions={<Btn onClick={saveSettings}>Save Changes</Btn>}
      />

      <TabBar
        tabs={[
          { value: 'facility', label: 'Facility' },
          { value: 'pools', label: 'Pools' },
          { value: 'modules', label: 'Modules' },
          { value: 'network', label: 'Terminals' },
          { value: 'stripe', label: 'Stripe' },
          { value: 'licence', label: 'Licence' },
          { value: 'data', label: 'Data' },
          { value: 'system', label: 'System' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'facility' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-xl">
          <h3 className="text-sm font-semibold mb-4 text-gray-900">Facility Details</h3>
          <Field label="Facility Name">
            <Input
              value={local.facility_name || 'EA Networks Centre'}
              onChange={(e) => set('facility_name', e.target.value)}
            />
          </Field>
          <Field label="Address">
            <Input value={local.facility_address || ''} onChange={(e) => set('facility_address', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={local.facility_phone || ''} onChange={(e) => set('facility_phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={local.facility_email || ''} onChange={(e) => set('facility_email', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {tab === 'pools' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-2xl">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Pools & Spa Configuration</h3>
            <Btn
              size="sm"
              onClick={() => {
                setEditPool(null);
                setPoolForm(true);
              }}
            >
              + Add Pool
            </Btn>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-5 py-2">Name</th>
                <th className="text-left px-5 py-2">Type</th>
                <th className="text-right px-5 py-2">Volume (kL)</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pools.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 font-medium text-gray-900">{p.name}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-600 capitalize">{p.type}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-sm">
                    {p.volume_litres ? (p.volume_litres / 1000).toFixed(0) : '—'}
                  </td>
                  <td className="px-5 py-2.5">
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditPool(p);
                        setPoolForm(true);
                      }}
                    >
                      Edit
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {poolForm && (
            <PoolFormModal
              pool={editPool}
              onClose={() => {
                setPoolForm(false);
                setEditPool(null);
              }}
              onSaved={() => {
                dbQuery('pools:list').then((p) => setPools(p || []));
                setPoolForm(false);
              }}
            />
          )}
        </div>
      )}

      {tab === 'modules' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-md">
          <h3 className="text-sm font-semibold mb-4 text-gray-900">Module Visibility</h3>
          <p className="text-xs text-gray-500 mb-4">
            Toggle modules for this facility. New features are added in{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">src/config/modules.js</code>.
          </p>
          {moduleToggles.map(([k, l]) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{l}</span>
              <button
                onClick={() => set(k, local[k] === '0' ? '1' : '0')}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  local[k] !== '0' ? 'bg-cyan-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                  style={{ transform: local[k] !== '0' ? 'translateX(16px)' : 'none' }}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'network' && terminalConfig && (
        <div className="space-y-4 max-w-xl">
          <div
            className={`rounded-xl border p-4 ${
              health?.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="text-sm font-semibold">{health?.ok ? 'Connected to data server' : 'Cannot reach data server'}</div>
            <div className="text-xs text-gray-600 mt-1">
              {health?.ok
                ? `${health.service} · ${health.hostname} · Schema v${health.schemaVersion ?? '—'}`
                : 'Check server PC is on and URL is correct'}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">This terminal</h3>
            <Field label="Terminal ID (shown in sidebar)">
              <Input
                value={local.terminal_id || terminalConfig.terminalId || 'T1'}
                onChange={(e) => {
                  set('terminal_id', e.target.value);
                  setTerminalConfig((c) => ({ ...c, terminalId: e.target.value }));
                }}
              />
            </Field>
            <Field label="Role">
              <Select
                value={terminalConfig.role || 'server'}
                onChange={(e) => setTerminalConfig((c) => ({ ...c, role: e.target.value }))}
              >
                <option value="server">Data server (primary PC — hosts database)</option>
                <option value="client">Client terminal (connects to server PC)</option>
              </Select>
            </Field>
            {terminalConfig.role === 'server' ? (
              <Field label="Server port (LAN)">
                <Input
                  type="number"
                  value={terminalConfig.serverPort || 3847}
                  onChange={(e) =>
                    setTerminalConfig((c) => ({
                      ...c,
                      serverPort: Number(e.target.value),
                      serverUrl: `http://127.0.0.1:${e.target.value}`,
                    }))
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Other PCs use: http://&lt;this-PC-IP&gt;:{terminalConfig.serverPort || 3847}
                </p>
              </Field>
            ) : (
              <Field label="Data server URL">
                <Input
                  value={terminalConfig.serverUrl || ''}
                  onChange={(e) => setTerminalConfig((c) => ({ ...c, serverUrl: e.target.value }))}
                  placeholder="http://192.168.1.50:3847"
                />
              </Field>
            )}
            <Btn onClick={saveTerminalConfig}>Save terminal connection</Btn>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <strong>Multi-terminal setup</strong>
            <ol className="list-decimal ml-4 mt-2 space-y-1 text-xs">
              <li>Install FacilityOS on the office/plant-room PC → set role to Data server.</li>
              <li>Note this PC&apos;s IP address (e.g. 192.168.1.50).</li>
              <li>On pool deck, reception, and gym terminals → set role to Client and enter the server URL.</li>
              <li>Allow port {terminalConfig.serverPort || 3847} through Windows Firewall on the server PC.</li>
            </ol>
          </div>
        </div>
      )}

      {tab === 'network' && !terminalConfig && (
        <p className="text-sm text-gray-500">Terminal settings are available in the installed desktop app.</p>
      )}

      {tab === 'stripe' && (
        <div className="space-y-4 max-w-xl">
          <div
            className={`rounded-xl border p-4 flex items-center gap-3 ${
              local.stripe_enabled === '1' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}
          >
            <span className="text-2xl">{local.stripe_enabled === '1' ? '✅' : '⚠️'}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {local.stripe_enabled === '1' ? 'Stripe enabled' : 'Stripe disabled'}
              </div>
              <div className="text-xs text-gray-500">Card-present payments via Stripe Terminal</div>
            </div>
            <Btn
              variant={local.stripe_enabled === '1' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => set('stripe_enabled', local.stripe_enabled === '1' ? '0' : '1')}
            >
              {local.stripe_enabled === '1' ? 'Disable' : 'Enable'}
            </Btn>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Field label="Publishable Key">
              <Input
                value={local.stripe_publishable_key || ''}
                onChange={(e) => set('stripe_publishable_key', e.target.value)}
                placeholder="pk_test_…"
              />
            </Field>
          </div>
        </div>
      )}

      {tab === 'licence' && licence && (
        <div className="space-y-4 max-w-xl">
          <div className={`rounded-xl border p-5 ${licence.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <h3 className="font-semibold text-gray-900">Subscription status</h3>
            <p className="text-sm mt-2">{licence.valid ? `Active — ${licence.daysRemaining} days remaining` : 'Expired or invalid'}</p>
            <p className="text-xs text-gray-600 mt-1">Plan: {licence.plan} · Key: {licence.licence_key}</p>
            <p className="text-xs text-gray-600">Expires: {licence.expires_at?.slice(0, 10)} · Max terminals: {licence.max_terminals}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold mb-3">Renew / activate (administrator)</h3>
            <Field label="Licence key"><Input value={licForm.key} onChange={(e) => setLicForm((f) => ({ ...f, key: e.target.value }))} /></Field>
            <Field label="Expiry date"><Input type="date" value={licForm.expiry} onChange={(e) => setLicForm((f) => ({ ...f, expiry: e.target.value }))} /></Field>
            <div className="flex gap-2 flex-wrap">
              <Btn onClick={async () => {
                await dbQuery('licence:activate', { licence_key: licForm.key, expires_at: licForm.expiry });
                dbQuery('licence:status').then(setLicence);
                toast('Licence updated');
              }}>Activate</Btn>
              <Btn variant="secondary" onClick={async () => {
                await dbQuery('licence:renew', { days: parseInt(licForm.days, 10) || 365 });
                dbQuery('licence:status').then(setLicence);
                toast('Extended');
              }}>Extend {licForm.days} days</Btn>
            </div>
            <Field label="Extension days"><Input type="number" value={licForm.days} onChange={(e) => setLicForm((f) => ({ ...f, days: e.target.value }))} /></Field>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Database backup &amp; integrity</h3>
            <p className="text-xs text-gray-500">
              Backups are stored on the data server at{' '}
              <code className="bg-gray-100 px-1 rounded">%ProgramData%\FacilityOS\data\backups\</code>
            </p>

            <div className={`rounded-lg border p-3 text-sm ${integrity?.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : integrity ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
              {integrity?.ok ? 'Database integrity check passed' : integrity ? `Integrity issue: ${integrity.messages?.join(', ')}` : 'Run integrity check to verify database health'}
            </div>

            <div className="flex flex-wrap gap-2">
              <Btn variant="secondary" onClick={backupDatabase} disabled={backupBusy}>
                {backupBusy ? 'Working…' : 'Create backup now'}
              </Btn>
              <Btn variant="secondary" onClick={refreshIntegrity}>Run integrity check</Btn>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
              <Field label="Automatic backups">
                <Select value={local.backup_auto_enabled ?? '1'} onChange={(e) => set('backup_auto_enabled', e.target.value)}>
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </Select>
              </Field>
              <Field label="Interval (hours)">
                <Input type="number" min="1" value={local.backup_interval_hours ?? '24'} onChange={(e) => set('backup_interval_hours', e.target.value)} />
              </Field>
              <Field label="Keep backups">
                <Input type="number" min="3" value={local.backup_retention_count ?? '14'} onChange={(e) => set('backup_retention_count', e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-gray-400">Save settings above, then restart the data server for schedule changes to apply.</p>

            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Available backups</h4>
              {backups.length === 0 ? (
                <p className="text-sm text-gray-400">No backups yet</p>
              ) : (
                <ul className="space-y-2">
                  {backups.map((b) => (
                    <li key={b.filename} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 text-sm">
                      <div>
                        <div className="font-medium text-gray-900">{b.filename}</div>
                        <div className="text-xs text-gray-400">{b.createdAt?.slice(0, 19).replace('T', ' ')} · {formatBytes(b.sizeBytes)}</div>
                      </div>
                      <Btn variant="ghost" size="sm" onClick={() => restoreFromBackup(b.filename)} disabled={backupBusy}>
                        Restore
                      </Btn>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold">Export</h3>
            <div className="flex flex-wrap gap-2">
              <Btn variant="secondary" size="sm" onClick={async () => { const r = await dbQuery('export:tests', { from_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) }); downloadCsv(r); toast(`Exported ${r.count} tests`); }}>Water tests CSV</Btn>
              <Btn variant="secondary" size="sm" onClick={async () => { const r = await dbQuery('export:staff'); downloadCsv(r); toast(`Exported ${r.count} staff`); }}>Staff CSV</Btn>
            </div>
            <h3 className="text-sm font-semibold border-t pt-4">Import staff</h3>
            <input type="file" accept=".csv" className="text-sm" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const rows = parseCsv(text);
              const r = await dbQuery('import:staff', { rows });
              toast(`Imported ${r.imported} staff`);
            }} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold mb-3">Recent audit log</h3>
            {auditLog.length === 0 ? (
              <p className="text-sm text-gray-400">No audit entries yet</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Action</th>
                    <th className="text-left py-2">Entity</th>
                    <th className="text-left py-2">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {auditLog.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 text-gray-500">{row.created_at?.slice(0, 19).replace('T', ' ')}</td>
                      <td className="py-2 font-medium text-gray-800">{row.action}</td>
                      <td className="py-2 text-gray-600">{row.entity_type}{row.entity_id ? ` · ${row.entity_id}` : ''}</td>
                      <td className="py-2 text-gray-400">{row.actor || row.terminal_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold mb-3 text-gray-900">Shared database</h3>
            <p className="text-xs text-gray-500 mb-3">
              All terminals use one database on the data server:
              <code className="block mt-1">%ProgramData%\FacilityOS\data\facilityos.db</code>
            </p>
            {window.facilityos?.restartServer && (
              <Btn variant="secondary" onClick={async () => { await window.facilityos.restartServer(); toast('Data server restarted'); }}>Restart data server</Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PoolFormModal({ pool, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [form, setForm] = useState(
    pool || { name: '', type: 'pool', location: '', volume_litres: '', max_patrons: '' }
  );
  const [limitForm, setLimitForm] = useState(() => limitsToForm(pool?.custom_limits));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const typeHint = {
    pool: 'Routine water chemistry tests (NZS 5826)',
    spa: 'Heated spa pool — water tests, not steam room checks',
    steam_room: 'Steam room hygiene checks only — no FAC/pH testing here',
    sauna: 'Sauna hygiene checks only',
  };

  async function save() {
    if (!form.name) {
      toast('Name required', 'warn');
      return;
    }
    const payload = {
      ...form,
      custom_limits: formToLimits(limitForm),
      volume_litres: form.volume_litres ? parseFloat(form.volume_litres) : null,
      max_patrons: form.max_patrons ? parseInt(form.max_patrons, 10) : null,
    };
    try {
      if (pool?.id) await dbQuery('pools:update', { id: pool.id, ...payload });
      else await dbQuery('pools:create', payload);
      toast(pool ? 'Pool updated' : 'Pool added');
      onSaved();
    } catch (e) {
      toast('Save failed', 'error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{pool ? 'Edit Pool' : 'Add Pool'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Main Pool" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="pool">Pool (water tests)</option>
              <option value="spa">Spa pool (water tests)</option>
              <option value="steam_room">Steam room (hygiene checks)</option>
              <option value="sauna">Sauna (hygiene checks)</option>
            </Select>
            <p className="text-[10px] text-gray-500 mt-1">{typeHint[form.type]}</p>
          </Field>
          <Field label="Location">
            <Input value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Volume (litres)">
            <Input type="number" value={form.volume_litres || ''} onChange={(e) => set('volume_litres', e.target.value)} />
          </Field>
          <Field label="Max Patrons">
            <Input type="number" value={form.max_patrons || ''} onChange={(e) => set('max_patrons', e.target.value)} />
          </Field>
        </div>

        {(form.type === 'pool' || form.type === 'spa') && (
          <CustomLimitsEditor poolType={form.type} limitForm={limitForm} setLimitForm={setLimitForm} />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save}>{pool ? 'Save' : 'Add Pool'}</Btn>
        </div>
      </div>
    </div>
  );
}
