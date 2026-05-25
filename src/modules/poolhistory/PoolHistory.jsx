import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, ComplianceBadge, Btn, Spinner, TabBar } from '../../components/ui';
import { checkOverallCompliance, checkParam } from '../../utils/compliance';
import { parseCustomLimits } from '../../utils/poolUtils';

export default function PoolHistory() {
  const { selectedPoolId, setModule } = useAppStore();
  const [pool, setPool] = useState(null);
  const [tests, setTests] = useState([]);
  const [closures, setClosures] = useState([]);
  const [tab, setTab] = useState('tests');
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    if (!selectedPoolId) {
      setModule('pools');
      return;
    }
    setLoading(true);
    Promise.all([
      dbQuery('pools:get', selectedPoolId),
      dbQuery('tests:list', { pool_id: selectedPoolId, limit: 500 }),
      dbQuery('closures:list', { pool_id: selectedPoolId }),
    ])
      .then(([p, t, c]) => {
        setPool(p);
        setTests(t || []);
        setClosures(c || []);
      })
      .finally(() => setLoading(false));
  }, [selectedPoolId, setModule]);

  if (loading) return <Spinner />;
  if (!pool) return <div className="text-gray-400 text-center py-16">No pool selected</div>;

  const customLimits = parseCustomLimits(pool.custom_limits);
  const compliantCount = tests.filter((t) => checkOverallCompliance(t, pool.type, customLimits)).length;
  const complianceRate = tests.length > 0 ? Math.round((compliantCount / tests.length) * 100) : null;

  return (
    <div>
      <PageHeader
        title={pool.name}
        subtitle={`${pool.type}${pool.volume_litres ? ` · ${(pool.volume_litres / 1000).toFixed(0)} kL` : ''}`}
        actions={<Btn variant="secondary" onClick={() => setModule('pools')}>← Back to Pools</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{tests.length}</div>
          <div className="text-xs text-gray-400">Total Tests</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-bold ${complianceRate >= 95 ? 'text-emerald-600' : complianceRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
            {complianceRate != null ? `${complianceRate}%` : '—'}
          </div>
          <div className="text-xs text-gray-400">Compliance Rate</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-600">{tests.length - compliantCount}</div>
          <div className="text-xs text-gray-400">Non-Compliant</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{closures.length}</div>
          <div className="text-xs text-gray-400">Closures</div>
        </div>
      </div>

      <TabBar tabs={[{ value: 'tests', label: 'Test Results' }, { value: 'closures', label: 'Closures' }]} active={tab} onChange={setTab} />

      {tab === 'tests' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold">{tests.length} test results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-right px-4 py-2">FAC</th>
                  <th className="text-right px-4 py-2">pH</th>
                  <th className="text-right px-4 py-2">Temp</th>
                  <th className="text-left px-4 py-2">By</th>
                  <th className="text-left px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tests.map((t) => {
                  const compliant = checkOverallCompliance(t, pool.type, customLimits);
                  const facOk = checkParam('free_chlorine', t.free_chlorine, pool.type, customLimits);
                  const phOk = checkParam('ph', t.ph, pool.type, customLimits);
                  const isExpanded = expandedRow === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer ${compliant === false ? 'bg-red-50/30' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                      >
                        <td className="px-4 py-2 text-gray-700">{t.test_date}</td>
                        <td className="px-4 py-2 text-gray-500">{t.test_time || '—'}</td>
                        <td className={`px-4 py-2 text-right font-mono ${facOk === false ? 'text-red-600 font-semibold' : ''}`}>{t.free_chlorine ?? '—'}</td>
                        <td className={`px-4 py-2 text-right font-mono ${phOk === false ? 'text-red-600 font-semibold' : ''}`}>{t.ph ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-600">{t.temperature ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{t.tested_by || '—'}</td>
                        <td className="px-4 py-2"><ComplianceBadge compliant={compliant} /></td>
                      </tr>
                      {isExpanded && (t.action_taken || t.notes) && (
                        <tr className="bg-amber-50/50">
                          <td colSpan={7} className="px-4 py-2 text-xs text-gray-600">
                            {t.action_taken && <div><span className="font-medium">Action:</span> {t.action_taken}</div>}
                            {t.notes && <div><span className="font-medium">Notes:</span> {t.notes}</div>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'closures' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold">{closures.length} closure records</h3>
          </div>
          {closures.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No closures recorded</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-2">Closed</th>
                  <th className="text-left px-5 py-2">Reason</th>
                  <th className="text-left px-5 py-2">Reopened</th>
                  <th className="text-left px-5 py-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {closures.map((c) => {
                  const duration = c.reopened_at
                    ? `${Math.round((new Date(c.reopened_at) - new Date(c.closed_at)) / 60000)} min`
                    : 'Still closed';
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2 text-gray-700">{c.closed_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-5 py-2 text-gray-900 font-medium">{c.reason}</td>
                      <td className="px-5 py-2 text-gray-400 text-xs">{c.reopened_at?.slice(0, 16).replace('T', ' ') || <span className="text-amber-600">Open</span>}</td>
                      <td className="px-5 py-2 text-xs text-gray-500">{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
