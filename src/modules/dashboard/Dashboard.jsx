import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { MODULE_REGISTRY } from '../../config/modules';
import { isModuleAccessible } from '../../utils/moduleAccess';
import { StatCard, ComplianceBadge, Spinner, Btn } from '../../components/ui';
import TestEntryModal from '../../components/TestEntryModal';
import SteamCheckModal from '../../components/SteamCheckModal';
import { checkOverallCompliance } from '../../utils/compliance';
import { isWaterTestPool, parseCustomLimits, getPoolTypeMeta } from '../../utils/poolUtils';
import PhoneSetupBanner from '../../components/PhoneSetupBanner';

const MODULE_CARDS = [
  { key: 'show_pools', label: 'Pool Management', desc: 'Test logs & compliance', icon: '🏊', mod: 'pools', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  { key: 'show_steam', label: 'Steam & Sauna', desc: 'Steam room checks', icon: '♨️', mod: 'steam', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'show_work_orders', label: 'Work Orders', desc: 'Maintenance requests', icon: '📋', mod: 'workorders', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { key: 'show_maintenance', label: 'Schedules', desc: 'Scheduled maintenance', icon: '📅', mod: 'schedules', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  { key: 'show_staff', label: 'Staff', desc: 'Staff & qualifications', icon: '👥', mod: 'staff', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { key: 'show_reports', label: 'Reports', desc: 'Analytics & compliance', icon: '📊', mod: 'reports', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'show_manager_dashboard', label: 'Manager View', desc: 'KPIs & alerts', icon: '📈', mod: 'managerdashboard', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
];

export default function Dashboard() {
  const { setModule, settings, toast, facility, licence } = useAppStore();
  const [pools, setPools] = useState([]);
  const [latestTests, setLatestTests] = useState([]);
  const [workSummary, setWorkSummary] = useState({});
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testModal, setTestModal] = useState(false);
  const [testPool, setTestPool] = useState(null);
  const [steamModal, setSteamModal] = useState(false);
  const [todayTests, setTodayTests] = useState(0);

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    Promise.all([
      dbQuery('pools:list', { facility_id: facility?.id }),
      dbQuery('tests:latest_per_pool', { facility_id: facility?.id }),
      dbQuery('reports:workorder_summary'),
      dbQuery('reports:overdue_schedules'),
      dbQuery('tests:list', { from_date: today, limit: 500 }),
    ])
      .then(([p, t, ws, od, todayList]) => {
        setPools(p || []);
        setLatestTests(t || []);
        setWorkSummary(ws || {});
        setOverdue(od || []);
        setTodayTests(todayList?.length || 0);
      })
      .catch(() => toast('Failed to load dashboard', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isEnabled = (modId) => {
    const mod = MODULE_REGISTRY.find((m) => m.id === modId);
    return mod ? isModuleAccessible(mod, settings, licence) : false;
  };
  const waterPools = pools.filter((p) => isWaterTestPool(p.type));

  const poolCompliance = waterPools.map((pool) => {
    const latest = latestTests.find((t) => t.pool_id === pool.id);
    const customLimits = parseCustomLimits(pool.custom_limits);
    const compliant = latest ? checkOverallCompliance(latest, pool.type, customLimits) : null;
    return { pool, latest, compliant };
  });

  const compliantCount = poolCompliance.filter((p) => p.compliant === true).length;
  const nonCompliantCount = poolCompliance.filter((p) => p.compliant === false).length;
  const openWOs = (workSummary.open || 0) + (workSummary.in_progress || 0);
  const urgentWOs = workSummary.urgent || 0;

  if (loading) return <Spinner />;

  return (
    <div>
      <PhoneSetupBanner />
      {/* Quick operations — primary testing entry points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => { setTestPool(null); setTestModal(true); }}
          className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-900/20 hover:shadow-xl transition-all text-left"
        >
          <span className="text-4xl">🏊</span>
          <div>
            <div className="text-lg font-bold">Record pool water test</div>
            <div className="text-sm text-cyan-100 opacity-90">Pools & spa pools · NZS 5826 · PIN sign-off</div>
          </div>
          <span className="ml-auto text-2xl opacity-70 group-hover:translate-x-1 transition-transform">→</span>
        </button>
        <button
          type="button"
          onClick={() => setSteamModal(true)}
          className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-900/20 hover:shadow-xl transition-all text-left"
        >
          <span className="text-4xl">💨</span>
          <div>
            <div className="text-lg font-bold">Steam / sauna check</div>
            <div className="text-sm text-orange-100 opacity-90">Steam rooms & saunas only — not spa water tests</div>
          </div>
          <span className="ml-auto text-2xl opacity-70 group-hover:translate-x-1 transition-transform">→</span>
        </button>
      </div>

      {poolCompliance.filter((p) => p.compliant === false).length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="text-sm font-semibold text-red-800 mb-1">Non-compliant readings require action</div>
          <div className="text-xs text-red-700 space-y-0.5">
            {poolCompliance.filter((p) => p.compliant === false).map(({ pool, latest }) => (
              <div key={pool.id}>
                <strong>{pool.name}</strong> — tested {latest.test_time || latest.test_date}
                {latest.tested_by ? ` by ${latest.tested_by}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Tests today" value={todayTests} delta="recorded today" accent="cyan" />
        <StatCard label="Compliant (water)" value={`${compliantCount}/${waterPools.length}`} delta="pools & spas" accent="emerald" />
        <StatCard label="Non-compliant" value={nonCompliantCount} accent={nonCompliantCount > 0 ? 'red' : 'emerald'} />
        <StatCard label="Open work orders" value={openWOs} delta={urgentWOs > 0 ? `${urgentWOs} urgent` : '—'} accent={urgentWOs > 0 ? 'red' : 'cyan'} />
        <StatCard label="Overdue maintenance" value={overdue.length} accent={overdue.length > 0 ? 'amber' : 'emerald'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Water quality — pools & spas</h3>
            <Btn variant="ghost" size="sm" onClick={() => setModule('pools')}>All pools →</Btn>
          </div>
          <div className="divide-y divide-gray-50">
            {poolCompliance.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No pools or spas configured</div>
            ) : (
              poolCompliance.map(({ pool, latest, compliant }) => {
                const meta = getPoolTypeMeta(pool.type);
                return (
                  <div key={pool.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                    <span className="text-xl">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{pool.name}</div>
                      <div className="text-xs text-gray-400">
                        {latest
                          ? `Last tested ${format(new Date(latest.test_date), 'dd MMM')} ${latest.test_time || ''}`
                          : 'No tests recorded'}
                      </div>
                    </div>
                    <ComplianceBadge compliant={compliant} />
                    <Btn size="sm" variant="secondary" onClick={() => { setTestPool(pool); setTestModal(true); }}>Test</Btn>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Modules</h3>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {MODULE_CARDS.filter((m) => isEnabled(m.mod)).map((m) => (
              <button
                key={m.mod}
                type="button"
                onClick={() => setModule(m.mod)}
                className={`rounded-xl border p-3 text-left hover:opacity-90 transition-opacity ${m.color}`}
              >
                <div className="text-lg mb-1">{m.icon}</div>
                <div className="text-xs font-semibold leading-tight">{m.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-3">Work orders</h3>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {[['Open', workSummary.open || 0], ['In progress', workSummary.in_progress || 0], ['On hold', workSummary.on_hold || 0], ['Done', workSummary.completed || 0]].map(([l, v]) => (
              <div key={l}>
                <div className="text-xl font-bold text-gray-800">{v}</div>
                <div className="text-xs text-gray-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-3">Overdue maintenance</h3>
          {overdue.length === 0 ? (
            <p className="text-sm text-gray-400">All up to date</p>
          ) : (
            overdue.slice(0, 4).map((s) => (
              <div key={s.id} className="text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-red-500 mr-1">⚠</span>
                {s.task_name}
                <span className="text-gray-400 text-xs ml-1">· due {s.next_due}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <TestEntryModal
        open={testModal}
        onClose={() => { setTestModal(false); setTestPool(null); }}
        pool={testPool}
        pools={waterPools}
        onSaved={() => {
          dbQuery('tests:latest_per_pool').then(setLatestTests);
        }}
      />
      <SteamCheckModal open={steamModal} onClose={() => setSteamModal(false)} pools={pools} />
    </div>
  );
}
