import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, Card, Btn, Field, Input, Select, Textarea, Spinner, StatusBadge } from '../../components/ui';

export default function Closures() {
  const { toast, currentStaff } = useAppStore();
  const [pools, setPools] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [entry, setEntry] = useState({ pool_id: '', reason: '', notes: '' });

  function load() {
    setLoading(true);
    Promise.all([dbQuery('pools:list'), dbQuery('closures:list')]).then(([p, c]) => {
      setPools(p || []);
      setClosures(c || []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function closePool() {
    if (!entry.pool_id || !entry.reason) { toast('Pool and reason required', 'warn'); return; }
    await dbQuery('closures:create', {
      ...entry,
      closed_by: currentStaff?.name,
      closed_at: new Date().toISOString(),
    });
    toast('Pool closed');
    setForm(false);
    load();
  }

  async function reopen(id) {
    await dbQuery('closures:reopen', { id, reopened_by: currentStaff?.name });
    toast('Pool reopened');
    load();
  }

  if (loading) return <Spinner />;

  const openClosures = closures.filter((c) => !c.reopened_at);

  return (
    <div>
      <PageHeader title="Pool Closures" subtitle="Track closures and reopening for compliance records"
        actions={<Btn onClick={() => setForm(true)}>+ Close pool</Btn>} />
      {openClosures.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <strong>{openClosures.length}</strong> pool(s) currently closed
        </div>
      )}
      {form && (
        <Card className="mb-5 max-w-lg">
          <Field label="Pool"><Select value={entry.pool_id} onChange={(e) => setEntry((x) => ({ ...x, pool_id: e.target.value }))}>
            <option value="">Select…</option>{pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select></Field>
          <Field label="Reason"><Input value={entry.reason} onChange={(e) => setEntry((x) => ({ ...x, reason: e.target.value }))} placeholder="e.g. Contamination, maintenance" /></Field>
          <Field label="Notes"><Textarea value={entry.notes} onChange={(e) => setEntry((x) => ({ ...x, notes: e.target.value }))} /></Field>
          <div className="flex gap-2"><Btn onClick={closePool}>Close pool</Btn><Btn variant="secondary" onClick={() => setForm(false)}>Cancel</Btn></div>
        </Card>
      )}
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 uppercase border-b">
            <th className="text-left py-2 px-3">Pool</th><th className="text-left py-2">Reason</th><th className="text-left py-2">Closed</th><th className="text-left py-2">Status</th><th className="py-2" />
          </tr></thead>
          <tbody>
            {closures.map((c) => {
              const p = pools.find((x) => x.id === c.pool_id);
              const open = !c.reopened_at;
              return (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium">{p?.name}</td>
                  <td>{c.reason}</td>
                  <td className="text-gray-600">{c.closed_at?.slice(0, 16)}</td>
                  <td><StatusBadge status={open ? 'open' : 'completed'} /></td>
                  <td className="text-right px-3">{open && <Btn size="sm" variant="secondary" onClick={() => reopen(c.id)}>Reopen</Btn>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
