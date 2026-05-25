import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, StatCard, Spinner } from '../../components/ui';
import { isWaterTestPool } from '../../utils/poolUtils';
import { format } from 'date-fns';

export default function ManagerDashboard() {
  const { facility } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [compliance, setCompliance] = useState([]);
  const [workSummary, setWorkSummary] = useState({});
  const [overdue, setOverdue] = useState([]);
  const [staff, setStaff] = useState([]);
  const [latestTests, setLatestTests] = useState([]);
  const [pools, setPools] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dbQuery('pools:list'),
      dbQuery('reports:compliance_summary', { days }),
      dbQuery('reports:workorder_summary'),
      dbQuery('reports:overdue_schedules'),
      dbQuery('staff:list', { status: 'active' }),
      dbQuery('tests:latest_per_pool'),
    ])
      .then(([p, c, ws, od, st, lt]) => {
        setPools(p || []);
        setCompliance(c || []);
        setWorkSummary(ws || {});
        setOverdue(od || []);
        setStaff(st || []);
        setLatestTests(lt || []);
      })
      .finally(() => setLoading(false));
  }, [days, facility?.id]);

  const waterPools = pools.filter((p) => isWaterTestPool(p.type));
  const totalTests = compliance.reduce((s, r) => s + (r.test_count || 0), 0);
  const totalCompliant = compliance.reduce((s, r) => s + (r.compliant_count || 0), 0);
  const complianceRate = totalTests > 0 ? Math.round((totalCompliant / totalTests) * 100) : null;
  const today = format(new Date(), 'yyyy-MM-dd');

  const poolsNotTestedToday = waterPools.filter((p) => {
    const latest = latestTests.find((t) => t.pool_id === p.id);
    return !latest || latest.test_date !== today;
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Manager Dashboard"
        subtitle="Facility KPIs and operational alerts"
        actions={
          <select value={days} onChange={(e) => setDays(+e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Compliance Rate" value={complianceRate != null ? `${complianceRate}%` : '—'} accent={complianceRate >= 95 ? 'emerald' : complianceRate >= 80 ? 'amber' : 'red'} />
        <StatCard label="Tests Recorded" value={totalTests} delta={`last ${days} days`} accent="cyan" />
        <StatCard label="Open Work Orders" value={(workSummary.open || 0) + (workSummary.in_progress || 0)} delta={`${workSummary.urgent || 0} urgent`} accent={workSummary.urgent > 0 ? 'red' : 'cyan'} />
        <StatCard label="Overdue Tasks" value={overdue.length} accent={overdue.length > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Active Staff" value={staff.length} accent="blue" />
      </div>

      {(poolsNotTestedToday.length > 0 || overdue.length > 0 || workSummary.urgent > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">Alerts requiring attention</h3>
          <div className="space-y-1.5 text-sm text-amber-800">
            {poolsNotTestedToday.map((p) => (
              <div key={p.id}>🏊 <strong>{p.name}</strong> — no water test recorded today</div>
            ))}
            {overdue.slice(0, 5).map((s) => (
              <div key={s.id}>📅 <strong>{s.task_name}</strong> — overdue since {s.next_due}</div>
            ))}
            {workSummary.urgent > 0 && (
              <div className="text-red-700">📋 <strong>{workSummary.urgent} urgent work order{workSummary.urgent > 1 ? 's' : ''}</strong></div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Pool Compliance — {days} days</h3>
          </div>
          <div className="md:hidden divide-y divide-gray-50">
            {compliance
              .filter((r) => waterPools.find((p) => p.id === r.id))
              .sort((a, b) => {
                const rateA = a.test_count > 0 ? a.compliant_count / a.test_count : 0;
                const rateB = b.test_count > 0 ? b.compliant_count / b.test_count : 0;
                return rateB - rateA;
              })
              .map((r) => {
                const rate = r.test_count > 0 ? Math.round((r.compliant_count / r.test_count) * 100) : null;
                return (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{r.name}</span>
                    <span className="text-xs text-gray-500">{r.test_count} tests</span>
                    <span className={`text-sm font-semibold flex-shrink-0 ${rate >= 95 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                      {rate != null ? `${rate}%` : '—'}
                    </span>
                  </div>
                );
              })}
          </div>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="text-left px-5 py-2">Pool</th>
                <th className="text-right px-5 py-2">Tests</th>
                <th className="text-right px-5 py-2">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {compliance
                .filter((r) => waterPools.find((p) => p.id === r.id))
                .sort((a, b) => {
                  const rateA = a.test_count > 0 ? a.compliant_count / a.test_count : 0;
                  const rateB = b.test_count > 0 ? b.compliant_count / b.test_count : 0;
                  return rateB - rateA;
                })
                .map((r) => {
                  const rate = r.test_count > 0 ? Math.round((r.compliant_count / r.test_count) * 100) : null;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2 font-medium">{r.name}</td>
                      <td className="px-5 py-2 text-right font-mono text-gray-500">{r.test_count}</td>
                      <td className="px-5 py-2 text-right">
                        <span className={`font-semibold ${rate >= 95 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                          {rate != null ? `${rate}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Order Pipeline</h3>
          {[
            ['Open', workSummary.open || 0, 'bg-blue-500'],
            ['In Progress', workSummary.in_progress || 0, 'bg-amber-500'],
            ['On Hold', workSummary.on_hold || 0, 'bg-gray-400'],
            ['Completed', workSummary.completed || 0, 'bg-emerald-500'],
          ].map(([label, count, color]) => {
            const total = (workSummary.open || 0) + (workSummary.in_progress || 0) + (workSummary.on_hold || 0) + (workSummary.completed || 0);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={label} className="flex items-center gap-3 mb-3">
                <div className="w-24 text-sm text-gray-600">{label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-12 text-right text-sm font-semibold">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-5">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Active Staff ({staff.length})</h3>
        </div>
        <div className="md:hidden divide-y divide-gray-50">
          {staff.map((s) => {
            const expiringSoon = s.nzrrp_expiry && new Date(s.nzrrp_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            return (
              <div key={s.id} className="px-4 py-3">
                <div className="font-medium text-sm">{s.first_name} {s.last_name}</div>
                <div className="text-xs text-gray-500 capitalize mt-0.5">{s.role?.replace('_', ' ')}</div>
                {s.nzrrp_number && (
                  <div className={`text-xs mt-1 ${expiringSoon ? 'text-red-600' : 'text-gray-500'}`}>
                    NZRRP {s.nzrrp_number} · {s.nzrrp_expiry || 'no expiry'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="text-left px-5 py-2">Name</th>
                <th className="text-left px-5 py-2">Role</th>
                <th className="text-left px-5 py-2">NZRRP</th>
                <th className="text-left px-5 py-2">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => {
                const expiringSoon = s.nzrrp_expiry && new Date(s.nzrrp_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2 font-medium">{s.first_name} {s.last_name}</td>
                    <td className="px-5 py-2 text-gray-500 capitalize">{s.role?.replace('_', ' ')}</td>
                    <td className="px-5 py-2 font-mono text-xs">{s.nzrrp_number || '—'}</td>
                    <td className="px-5 py-2">
                      {s.nzrrp_expiry ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${expiringSoon ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {expiringSoon ? '⚠ ' : ''}{s.nzrrp_expiry}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
