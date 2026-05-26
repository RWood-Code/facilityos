import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, Btn, Field, Input, Select, TabBar } from '../../components/ui';
import { MODULE_REGISTRY } from '../../config/modules';
import { downloadCsv, parseCsv } from '../../utils/download';
import { listBackups, createBackup, restoreBackup, checkIntegrity, formatBytes } from '../../utils/serverApi';
import CustomLimitsEditor from '../../components/CustomLimitsEditor';
import MobileAccessPanel from '../../components/MobileAccessPanel';
import CloudConnectPanel from '../../components/CloudConnectPanel';
import { limitsToForm, formToLimits } from '../../utils/poolUtils';
import { isModuleLicensed, getModuleBlockReason } from '../../utils/moduleAccess';
import { checkServerHealth } from '../../hooks/useDb';
import { useLicenceCountdown } from '../../hooks/useLicenceCountdown';

function LicenceStatusCard({ licence }) {
  const countdown = useLicenceCountdown(licence?.expires_at);
  const isTrial = licence?.isTrial || licence?.plan === 'trial';
  const tone = !licence?.valid
    ? 'bg-red-50 border-red-200'
    : isTrial || licence?.daysRemaining <= 7
      ? 'bg-amber-50 border-amber-200'
      : 'bg-emerald-50 border-emerald-200';

  return (
    <div className={`rounded-xl border p-5 ${tone}`}>
      <h3 className="font-semibold text-gray-900">
        {isTrial ? 'Evaluation trial' : 'Subscription status'}
      </h3>
      <p className="text-sm mt-2">
        {licence.valid
          ? (countdown.expired ? 'Expired' : `${countdown.label} remaining`)
          : 'Expired or invalid'}
      </p>
      <p className="font-mono text-lg mt-2 tabular-nums text-gray-900">{countdown.label}</p>
      <p className="text-xs text-gray-600 mt-2">Plan: {licence.planLabel || licence.plan} · Key: {licence.licence_key}</p>
      <p className="text-xs text-gray-600">Expires: {licence.expires_at?.slice(0, 10)} · Max terminals: {licence.max_terminals}</p>
      {isTrial && licence.valid && (
        <p className="text-xs text-amber-800 mt-3">
          Trial access ends automatically. Install your vendor&apos;s facilityos.lic file before expiry.
        </p>
      )}
    </div>
  );
}

export default function Settings() {
  const { toast, setSettings, settings, licence: storeLicence, setLicence: setStoreLicence } = useAppStore();
  const [local, setLocal] = useState({});
  const [pools, setPools] = useState([]);
  const [tab, setTab] = useState(() => {
    try {
      const t = sessionStorage.getItem('facilityos_settings_tab');
      if (t) {
        sessionStorage.removeItem('facilityos_settings_tab');
        return t;
      }
    } catch { /* ignore */ }
    return 'facility';
  });
  const [poolForm, setPoolForm] = useState(false);
  const [editPool, setEditPool] = useState(null);
  const [terminalConfig, setTerminalConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [licence, setLicence] = useState(null);
  const [licForm, setLicForm] = useState({ licenceFile: '' });
  const [licenceFileInfo, setLicenceFileInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);

  async function refreshBackups() {
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
    const syncTab = () => {
      const h = window.location.hash.replace(/^#\/?/, '');
      if (h === 'phones') setTab('phones');
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
  }, []);

  useEffect(() => {
    Promise.all([dbQuery('settings:all'), dbQuery('pools:list')]).then(([s, p]) => {
      setLocal(s || {});
      setPools(p || []);
    });
    dbQuery('licence:status').then(setLicence).catch(() => {});
    dbQuery('licence:file_info').then(setLicenceFileInfo).catch(() => {});
    if (window.facilityos) {
      window.facilityos.getConfig().then(setTerminalConfig);
      window.facilityos.checkHealth().then(setHealth);
    } else {
      checkServerHealth().then(setHealth);
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

  const moduleToggles = MODULE_REGISTRY.filter((m) => m.settingKey && !m.alwaysOn && !m.navHidden);

  async function refreshLicence() {
    const status = await dbQuery('licence:status');
    setLicence(status);
    setStoreLicence(status);
    try {
      setLicenceFileInfo(await dbQuery('licence:file_info'));
    } catch { /* ignore */ }
    const s = await dbQuery('settings:all');
    setLocal(s || {});
    setSettings(s || {});
    return status;
  }

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
          { value: 'phones', label: 'Phones & tablets' },
          { value: 'pools', label: 'Pools' },
          { value: 'modules', label: 'Modules' },
          { value: 'network', label: 'Terminals' },
          { value: 'cloud', label: 'Cloud' },
          { value: 'licence', label: 'Licence' },
          { value: 'data', label: 'Data' },
          { value: 'system', label: 'System' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'phones' && (
        <MobileAccessPanel />
      )}

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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-lg">
          <h3 className="text-sm font-semibold mb-2 text-gray-900">Module visibility</h3>
          <p className="text-xs text-gray-500 mb-4">
            Your <strong>{storeLicence?.planLabel || storeLicence?.plan || 'licence'}</strong> plan controls which modules are available.
            Toggle licensed modules on or off for this facility, then click Save Changes.
          </p>
          {moduleToggles.map((mod) => {
            const licensed = isModuleLicensed(mod, storeLicence);
            const enabled = local[mod.settingKey] !== '0';
            return (
              <div key={mod.settingKey} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3">
                <div className="min-w-0">
                  <span className={`text-sm ${licensed ? 'text-gray-700' : 'text-gray-400'}`}>{mod.label}</span>
                  {!licensed && (
                    <div className="text-[10px] text-amber-600">{getModuleBlockReason(mod, local, storeLicence)}</div>
                  )}
                </div>
                {licensed ? (
                  <button
                    type="button"
                    onClick={() => set(mod.settingKey, enabled ? '0' : '1')}
                    className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-cyan-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                      style={{ transform: enabled ? 'translateX(16px)' : 'none' }}
                    />
                  </button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">Locked</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'network' && terminalConfig && (
        <div className="space-y-4 max-w-2xl">
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
        <div className="space-y-4 max-w-xl">
          <p className="text-sm text-gray-500">Terminal role settings are available in the installed desktop app.</p>
        </div>
      )}

      {tab === 'cloud' && (
        <div className="max-w-2xl">
          <CloudConnectPanel />
        </div>
      )}

      {tab === 'licence' && licence && (
        <div className="space-y-4 max-w-2xl">
          <LicenceStatusCard licence={licence} />

          {licence.modules && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold mb-3 text-gray-900">Licensed modules</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(licence.modules).map(([key, on]) => (
                  <span key={key} className={`text-xs px-2 py-1 rounded-full ${on ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400 line-through'}`}>
                    {key.replace('_', ' ')}
                  </span>
                ))}
              </div>
              <Btn variant="secondary" size="sm" className="mt-3" onClick={async () => {
                await dbQuery('licence:sync_modules');
                await refreshLicence();
                toast('Module access synced from licence plan');
              }}>Sync modules from plan</Btn>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold mb-1">Install licence certificate</h3>
            <p className="text-xs text-gray-500 mb-4">
              Use the signed <strong>facilityos.lic</strong> file from your vendor. Expiry, plan, and modules are verified with Ed25519 — they cannot be changed manually.
            </p>
            {licenceFileInfo && (
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-4 break-all">
                <p className="font-medium text-gray-800 mb-1">Licence file location (data server)</p>
                <code>{licenceFileInfo.path}</code>
                {licenceFileInfo.exists && (
                  <p className="mt-1 text-emerald-700">File installed · updated {licenceFileInfo.modified_at?.slice(0, 10)}</p>
                )}
                {!licenceFileInfo.exists && (
                  <p className="mt-1 text-gray-500">No file yet — upload below or copy facilityos.lic into the folder above and restart.</p>
                )}
              </div>
            )}
            <Field label="Upload facilityos.lic">
              <input
                type="file"
                accept=".lic,.json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    await dbQuery('licence:activate', { licence_file: text.trim() });
                    await refreshLicence();
                    setLicForm({ licenceFile: '' });
                    toast('Licence installed');
                  } catch (err) {
                    toast(err.message || 'Activation failed', 'error');
                  }
                  e.target.value = '';
                }}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:text-cyan-800 file:font-medium"
              />
            </Field>
            <Field label="Or paste licence file contents">
              <Input
                value={licForm.licenceFile}
                onChange={(e) => setLicForm((f) => ({ ...f, licenceFile: e.target.value }))}
                placeholder="Paste facilityos.lic JSON"
                autoComplete="off"
              />
            </Field>
            <Btn
              onClick={async () => {
                if (!licForm.licenceFile.trim()) return;
                try {
                  await dbQuery('licence:activate', { licence_file: licForm.licenceFile.trim() });
                  await refreshLicence();
                  setLicForm({ licenceFile: '' });
                  toast('Licence installed');
                } catch (e) {
                  toast(e.message || 'Activation failed', 'error');
                }
              }}
              disabled={!licForm.licenceFile.trim()}
            >
              Install licence
            </Btn>
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
