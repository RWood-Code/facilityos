import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, ComplianceBadge, StatCard, Spinner, TabBar, Btn } from '../../components/ui';
import TrendChart from '../../components/TrendChart';
import CustomReportBuilder from './CustomReportBuilder';
import { checkOverallCompliance } from '../../utils/compliance';
import { parseCustomLimits, isWaterTestPool } from '../../utils/poolUtils';
import { exportRowsToCsv } from '../../utils/download';

const TREND_PARAMS = [
  { value: 'free_chlorine', label: 'Free Chlorine (FAC)' },
  { value: 'ph', label: 'pH' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'total_alkalinity', label: 'Total Alkalinity' },
  { value: 'turbidity', label: 'Turbidity' },
  { value: 'total_available_chlorine', label: 'Total Available Chlorine' },
];

function testExportRows(tests, pools) {
  return tests.map((t) => {
    const pool = pools.find((p) => p.id === t.pool_id);
    return {
      date: t.test_date,
      time: t.test_time || '',
      pool: pool?.name || t.pool_id,
      fac: t.free_chlorine ?? '',
      tac: t.total_available_chlorine ?? '',
      ph: t.ph ?? '',
      temperature: t.temperature ?? '',
      total_alkalinity: t.total_alkalinity ?? '',
      turbidity: t.turbidity ?? '',
      tested_by: t.tested_by || '',
      compliant: t.is_compliant === 1 ? 'Yes' : t.is_compliant === 0 ? 'No' : '',
      action_taken: t.action_taken || '',
      notes: t.notes || '',
    };
  });
}

function complianceExportRows(compliance) {
  return compliance.map((r) => ({
    pool: r.name,
    tests: r.test_count,
    compliant: r.compliant_count,
    non_compliant: r.non_compliant_count,
    avg_fac: r.avg_fac ?? '',
    avg_ph: r.avg_ph ?? '',
    rate: r.test_count > 0 ? `${Math.round((r.compliant_count / r.test_count) * 100)}%` : '—',
    last_tested: r.last_tested?.slice(0, 10) || '—',
  }));
}

export default function Reports() {
  const { facility, toast } = useAppStore();
  const [tab, setTab] = useState('compliance');
  const [pools, setPools] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [tests, setTests] = useState([]);
  const [workSummary, setWorkSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [savedReports, setSavedReports] = useState([]);
  const [newReportName, setNewReportName] = useState('');
  const [trendPool, setTrendPool] = useState('');
  const [trendParam, setTrendParam] = useState('free_chlorine');
  const [trendDays, setTrendDays] = useState(30);
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dbQuery('pools:list'),
      dbQuery('reports:compliance_summary', { facility_id: facility?.id, days }),
      dbQuery('tests:list', { limit: 500 }),
      dbQuery('reports:workorder_summary'),
    ])
      .then(([p, c, t, ws]) => {
        setPools(p || []);
        setCompliance(c || []);
        setTests(t || []);
        setWorkSummary(ws || {});
      })
      .finally(() => setLoading(false));
  }, [days, facility?.id]);

  useEffect(() => {
    if (tab === 'saved') {
      dbQuery('saved_reports:list').then(setSavedReports).catch(() => setSavedReports([]));
    }
  }, [tab]);

  const totalTests = compliance.reduce((s, r) => s + r.test_count, 0);
  const totalCompliant = compliance.reduce((s, r) => s + r.compliant_count, 0);
  const complianceRate = totalTests > 0 ? Math.round((totalCompliant / totalTests) * 100) : null;
  const waterPools = pools.filter((p) => isWaterTestPool(p.type));
  const stamp = new Date().toISOString().slice(0, 10);

  async function loadTrendChart() {
    if (!trendPool) return;
    setTrendLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - trendDays);
    try {
      const data = await dbQuery('tests:list', {
        pool_id: trendPool,
        from_date: from.toISOString().slice(0, 10),
        limit: 500,
      });
      setTrendData(data || []);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }

  function exportTests() {
    if (exportRowsToCsv(`test-log-${stamp}.csv`, testExportRows(tests, pools))) {
      toast('Test log exported');
    } else {
      toast('No test data to export', 'warn');
    }
  }

  function exportCompliance() {
    if (exportRowsToCsv(`compliance-${stamp}.csv`, complianceExportRows(compliance))) {
      toast('Compliance summary exported');
    } else {
      toast('No compliance data to export', 'warn');
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Compliance, maintenance, and operational reporting"
        actions={
          <select value={days} onChange={(e) => setDays(+e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Tests" value={totalTests} delta={`last ${days} days`} accent="cyan" />
        <StatCard label="Compliance Rate" value={complianceRate != null ? `${complianceRate}%` : '—'} delta="routine tests only" accent={complianceRate >= 95 ? 'emerald' : complianceRate >= 80 ? 'amber' : 'red'} />
        <StatCard label="Open Work Orders" value={(workSummary.open || 0) + (workSummary.in_progress || 0)} delta={`${workSummary.urgent || 0} urgent`} accent={workSummary.urgent ? 'red' : 'cyan'} />
        <StatCard label="Pools Monitored" value={pools.length} delta="active pools" accent="blue" />
      </div>

      <TabBar
        tabs={[
          { value: 'compliance', label: 'Pool Compliance' },
          { value: 'tests', label: 'Test Log' },
          { value: 'trends', label: 'Parameter Trends' },
          { value: 'maintenance', label: 'Maintenance' },
          { value: 'builder', label: 'Custom Builder' },
          { value: 'export', label: 'Data Export' },
          { value: 'saved', label: 'Saved Reports' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'builder' ? (
        <CustomReportBuilder onBack={() => setTab('compliance')} />
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          {tab === 'compliance' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Compliance by Pool — Last {days} Days</h3>
                <Btn variant="secondary" size="sm" onClick={exportCompliance}>Export CSV</Btn>
              </div>
              {compliance.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No test data for this period</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3">Pool</th>
                      <th className="text-right px-5 py-3">Tests</th>
                      <th className="text-right px-5 py-3">Compliant</th>
                      <th className="text-right px-5 py-3">Non-Compliant</th>
                      <th className="text-right px-5 py-3">Avg FAC</th>
                      <th className="text-right px-5 py-3">Avg pH</th>
                      <th className="text-right px-5 py-3">Rate</th>
                      <th className="text-left px-5 py-3">Last Tested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {compliance.map((r) => {
                      const rate = r.test_count > 0 ? Math.round((r.compliant_count / r.test_count) * 100) : null;
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                          <td className="px-5 py-3 text-right font-mono text-gray-700">{r.test_count}</td>
                          <td className="px-5 py-3 text-right font-mono text-emerald-600">{r.compliant_count}</td>
                          <td className="px-5 py-3 text-right font-mono text-red-600">{r.non_compliant_count}</td>
                          <td className="px-5 py-3 text-right font-mono text-sm text-gray-600">{r.avg_fac ?? '—'}</td>
                          <td className="px-5 py-3 text-right font-mono text-sm text-gray-600">{r.avg_ph ?? '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-semibold text-sm ${rate >= 95 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                              {rate != null ? `${rate}%` : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500">{r.last_tested?.slice(0, 10) || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'tests' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Recent Test Results</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{tests.length} records</span>
                  <Btn variant="secondary" size="sm" onClick={exportTests}>Export CSV</Btn>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Pool</th>
                      <th className="text-right px-4 py-2">FAC</th>
                      <th className="text-right px-4 py-2">pH</th>
                      <th className="text-right px-4 py-2">Temp</th>
                      <th className="text-left px-4 py-2">By</th>
                      <th className="text-left px-4 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tests.slice(0, 50).map((t) => {
                      const pool = pools.find((p) => p.id === t.pool_id);
                      const c = pool ? checkOverallCompliance(t, pool.type, parseCustomLimits(pool.custom_limits)) : null;
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{t.test_date}</td>
                          <td className="px-4 py-2 text-gray-600">{pool?.name || t.pool_id}</td>
                          <td className="px-4 py-2 text-right font-mono">{t.free_chlorine ?? '—'}</td>
                          <td className="px-4 py-2 text-right font-mono">{t.ph ?? '—'}</td>
                          <td className="px-4 py-2 text-right font-mono">{t.temperature ?? '—'}</td>
                          <td className="px-4 py-2 text-xs text-gray-400">{t.tested_by || '—'}</td>
                          <td className="px-4 py-2"><ComplianceBadge compliant={c} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'trends' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-wrap gap-3 mb-5">
                  <select value={trendPool} onChange={(e) => setTrendPool(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                    <option value="">Select pool…</option>
                    {waterPools.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select value={trendParam} onChange={(e) => setTrendParam(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                    {TREND_PARAMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <select value={trendDays} onChange={(e) => setTrendDays(+e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                  <Btn onClick={loadTrendChart} disabled={!trendPool || trendLoading}>
                    {trendLoading ? 'Loading…' : 'Load Chart'}
                  </Btn>
                </div>
                {trendLoading ? (
                  <Spinner />
                ) : trendData.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">Select a pool and click Load Chart</div>
                ) : (
                  <TrendChart data={trendData} param={trendParam} pool={pools.find((p) => p.id === trendPool)} />
                )}
              </div>
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Work Order Summary</h3>
              </div>
              <div className="grid grid-cols-5 divide-x divide-gray-100 py-6 text-center">
                {[['Open', workSummary.open || 0, 'text-blue-600'], ['In Progress', workSummary.in_progress || 0, 'text-amber-600'], ['On Hold', workSummary.on_hold || 0, 'text-gray-500'], ['Completed', workSummary.completed || 0, 'text-emerald-600'], ['Urgent', workSummary.urgent || 0, 'text-red-600']].map(([l, v, c]) => (
                  <div key={l}>
                    <div className={`text-3xl font-bold ${c}`}>{v}</div>
                    <div className="text-xs text-gray-400 mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Export Data</h3>
              <div className="space-y-3">
                {[
                  { label: 'Test Results', desc: 'All water test records in current view', fn: exportTests },
                  { label: 'Compliance Summary', desc: `Pool compliance rates — last ${days} days`, fn: exportCompliance },
                ].map(({ label, desc, fn }) => (
                  <div key={label} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{label}</div>
                      <div className="text-xs text-gray-400">{desc}</div>
                    </div>
                    <Btn variant="secondary" size="sm" onClick={fn}>Download CSV</Btn>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'saved' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-xl">
              <h3 className="text-sm font-semibold mb-3">Saved report configurations</h3>
              <div className="flex gap-2 mb-4">
                <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Report name" value={newReportName} onChange={(e) => setNewReportName(e.target.value)} />
                <Btn
                  size="sm"
                  onClick={async () => {
                    if (!newReportName.trim()) return;
                    try {
                      await dbQuery('saved_reports:create', { name: newReportName, report_type: 'compliance', config: { days } });
                      setNewReportName('');
                      dbQuery('saved_reports:list').then(setSavedReports).catch(() => {});
                      toast('Report saved');
                    } catch {
                      toast('Could not save report', 'warn');
                    }
                  }}
                >
                  Save current view
                </Btn>
              </div>
              <ul className="space-y-2">
                {savedReports.map((r) => (
                  <li key={r.id} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                    <span>{r.name} <span className="text-gray-400">({r.report_type})</span></span>
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await dbQuery('saved_reports:delete', r.id);
                          dbQuery('saved_reports:list').then(setSavedReports).catch(() => {});
                        } catch {
                          setSavedReports((prev) => prev.filter((x) => x.id !== r.id));
                        }
                      }}
                    >
                      Delete
                    </Btn>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
