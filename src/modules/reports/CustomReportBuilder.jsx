import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { dbQuery } from '../../hooks/useDb';import { useAppStore } from '../../store/appStore';
import { PageHeader, Btn, Modal, Field, Input, Select, Spinner, Card } from '../../components/ui';
import { exportRowsToCsv } from '../../utils/download';

const DATA_SOURCES = [
  { id: 'pool_tests', label: 'Pool Water Tests' },
  { id: 'work_orders', label: 'Work Orders' },
  { id: 'closures', label: 'Pool Closures' },
  { id: 'steam_room', label: 'Steam Room Checks' },
  { id: 'qualifications', label: 'Staff Qualifications' },
];

const FIELD_MAP = {
  pool_tests: [
    ['test_date', 'Date'], ['test_time', 'Time'], ['pool_id', 'Pool ID'],
    ['ph', 'pH'], ['free_chlorine', 'Free Cl'], ['temperature', 'Temp'],
    ['is_compliant', 'Compliant'], ['tested_by', 'Tester'], ['notes', 'Notes'],
  ],
  work_orders: [
    ['title', 'Title'], ['status', 'Status'], ['priority', 'Priority'],
    ['location', 'Location'], ['assigned_to', 'Assigned'], ['due_date', 'Due'],
    ['parts_cost', 'Parts $'], ['labor_cost', 'Labor $'],
  ],
  closures: [
    ['pool_id', 'Pool ID'], ['reason', 'Reason'], ['closed_at', 'Closed'],
    ['reopened_at', 'Reopened'], ['closed_by', 'Closed By'], ['notes', 'Notes'],
  ],
  steam_room: [
    ['check_date', 'Date'], ['check_time', 'Time'], ['temperature', 'Temp'],
    ['checked_by', 'Checked By'], ['patron_count', 'Patrons'], ['notes', 'Notes'],
  ],
  qualifications: [
    ['staff_id', 'Staff ID'], ['qualification', 'Qualification'], ['issuer', 'Issuer'],
    ['issued_date', 'Issued'], ['expiry_date', 'Expiry'], ['cert_number', 'Cert #'],
  ],
};

export default function CustomReportBuilder({ onBack }) {
  const { toast, facility } = useAppStore();
  const [pools, setPools] = useState([]);
  const [source, setSource] = useState('pool_tests');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [poolId, setPoolId] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [outputMode, setOutputMode] = useState('both');
  useEffect(() => {
    dbQuery('pools:list', { facility_id: facility?.id }).then(setPools).catch(() => {});
  }, [facility?.id]);

  useEffect(() => {
    const defaults = (FIELD_MAP[source] || []).map(([k]) => k).slice(0, 6);
    setSelectedFields(defaults);
    setResults([]);
    setRan(false);
  }, [source]);

  const fields = FIELD_MAP[source] || [];

  function toggleField(key) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function runReport() {
    if (!selectedFields.length) { toast('Select at least one field', 'warn'); return; }
    setLoading(true);
    try {
      let rows = [];
      if (source === 'pool_tests') {
        rows = await dbQuery('tests:list', { pool_id: poolId || undefined, from_date: dateFrom || undefined, limit: 2000 });
      } else if (source === 'work_orders') {
        rows = await dbQuery('workorders:list');
      } else if (source === 'closures') {
        rows = await dbQuery('closures:list', { pool_id: poolId || undefined });
      } else if (source === 'steam_room') {
        rows = await dbQuery('steamchecks:list', { limit: 2000 });
      } else if (source === 'qualifications') {
        rows = await dbQuery('qualifications:list');
      }
      rows = (rows || []).filter((row) => {
        const dateKey = row.test_date || row.check_date || row.closed_at || row.created_at;
        if (dateFrom && dateKey && dateKey < dateFrom) return false;
        if (dateTo && dateKey && dateKey.slice(0, 10) > dateTo) return false;
        if (poolId && row.pool_id && row.pool_id !== poolId) return false;
        return true;
      });
      setResults(rows);
      setRan(true);
    } catch {
      toast('Failed to run report', 'error');
    } finally {
      setLoading(false);
    }
  }

  const poolNames = useMemo(() => Object.fromEntries(pools.map((p) => [p.id, p.name])), [pools]);

  const dateField = useMemo(() => {
    const map = { pool_tests: 'test_date', work_orders: 'created_at', closures: 'closed_at', steam_room: 'check_date', qualifications: 'issued_date' };
    return map[source] || 'test_date';
  }, [source]);

  const chartData = useMemo(() => {
    if (!results.length) return [];
    const counts = {};
    results.forEach((row) => {
      const raw = row[dateField];
      const day = raw ? String(raw).slice(0, 10) : 'Unknown';
      counts[day] = (counts[day] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [results, dateField]);

  const numericChart = useMemo(() => {
    const numericField = selectedFields.find((k) => ['ph', 'free_chlorine', 'temperature', 'parts_cost', 'labor_cost'].includes(k));
    if (!numericField || !results.length) return null;
    return results
      .filter((r) => r[numericField] != null)
      .slice(-20)
      .map((r, i) => ({
        label: String(r[dateField] || i).slice(5, 10) || `#${i + 1}`,
        value: parseFloat(r[numericField]),
      }));
  }, [results, selectedFields, dateField]);
  function displayValue(row, key) {
    if (key === 'pool_id') return poolNames[row.pool_id] || row.pool_id;
    if (key === 'is_compliant') return row.is_compliant === 1 || row.is_compliant === true ? 'Yes' : row.is_compliant === 0 || row.is_compliant === false ? 'No' : '';
    return row[key] ?? '';
  }

  function exportCsv() {
    const headers = selectedFields.map((k) => (fields.find(([fk]) => fk === k)?.[1] || k));
    const csvRows = results.map((row) => {
      const out = {};
      selectedFields.forEach((k, i) => { out[headers[i]] = displayValue(row, k); });
      return out;
    });
    if (exportRowsToCsv(`custom-report-${format(new Date(), 'yyyy-MM-dd')}.csv`, csvRows)) {
      toast('Report exported');
    }
  }

  return (
    <div>
      <PageHeader
        title="Custom Report Builder"
        subtitle="Choose a data source, filters, and fields to build ad-hoc reports"
        actions={onBack && <Btn variant="secondary" onClick={onBack}>← Back to Reports</Btn>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 space-y-4">
          <Field label="Data source">
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              {DATA_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From date"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
            <Field label="To date"><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
          </div>
          {(source === 'pool_tests' || source === 'closures') && (
            <Field label="Pool filter">
              <Select value={poolId} onChange={(e) => setPoolId(e.target.value)}>
                <option value="">All pools</option>
                {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Fields to include">
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {fields.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedFields.includes(key)} onChange={() => toggleField(key)} />
                  {label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Output">
            <Select value={outputMode} onChange={(e) => setOutputMode(e.target.value)}>
              <option value="table">Table only</option>
              <option value="chart">Chart only</option>
              <option value="both">Table + chart</option>
            </Select>
          </Field>
          <Btn onClick={runReport} disabled={loading} className="w-full">            {loading ? 'Running…' : 'Run Report'}
          </Btn>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {(outputMode === 'chart' || outputMode === 'both') && ran && results.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Records over time</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {numericChart && (
                <>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 mt-6">Numeric trend (sample)</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={numericChart} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </Card>
          )}
          {(outputMode === 'table' || outputMode === 'both') && (
          <Card>            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Results {ran && <span className="text-gray-400 font-normal">({results.length} rows)</span>}
              </h3>
              {results.length > 0 && <Btn variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Btn>}
            </div>
            {!ran ? (
              <p className="text-sm text-gray-400 py-12 text-center">Configure filters and click Run Report</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-400 py-12 text-center">No records match your filters</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                      {selectedFields.map((k) => (
                        <th key={k} className="text-left px-3 py-2 whitespace-nowrap">
                          {fields.find(([fk]) => fk === k)?.[1] || k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.slice(0, 100).map((row, i) => (
                      <tr key={row.id || i} className="hover:bg-gray-50">
                        {selectedFields.map((k) => (
                          <td key={k} className="px-3 py-2 whitespace-nowrap text-gray-700">{displayValue(row, k)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length > 100 && (
                  <p className="text-xs text-gray-400 mt-3 text-center">Showing first 100 of {results.length} rows — export CSV for full data</p>
                )}
              </div>
            )}
          </Card>
          )}
        </div>      </div>
    </div>
  );
}
