import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, Card, Btn, Spinner, Empty } from '../../components/ui';
import SteamCheckModal from '../../components/SteamCheckModal';
import { isSteamCheckArea, getPoolTypeMeta } from '../../utils/poolUtils';

export default function SteamRoom() {
  const [pools, setPools] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkModal, setCheckModal] = useState(false);

  const steamAreas = pools.filter((p) => isSteamCheckArea(p.type));

  function load() {
    setLoading(true);
    Promise.all([dbQuery('pools:list'), dbQuery('steamchecks:list', { limit: 50 })])
      .then(([p, c]) => {
        setPools(p || []);
        setChecks(c || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Steam & Sauna"
        subtitle="Hygiene and comfort checks for steam rooms and saunas — not for spa pools (use Pool Management for spa water tests)"
        actions={<Btn onClick={() => setCheckModal(true)}>+ Log check</Btn>}
      />

      {steamAreas.length === 0 && (
        <Card className="mb-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-900">
            Add a <strong>Steam Room</strong> or <strong>Sauna</strong> in Settings → Pools.
            Your <strong>Spa Pool</strong> should stay type &quot;Spa&quot; for water chemistry testing.
          </p>
        </Card>
      )}

      <Card>
        {checks.length === 0 ? (
          <Empty icon="♨️" title="No checks yet" desc="Log steam room or sauna checks — not spa pools" />
        ) : (
          <>
            <div className="md:hidden space-y-2">
              {checks.map((c) => {
                const p = pools.find((x) => x.id === c.pool_id);
                const meta = getPoolTypeMeta(p?.type);
                return (
                  <div key={c.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{meta.icon} {p?.name || c.pool_id}</span>
                      <span className="text-xs text-gray-500 font-mono">{c.check_date}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                      <span>{c.check_time}</span>
                      <span>{c.checked_by || '—'}</span>
                      <span>{c.temperature ?? '—'}°C</span>
                      <span>Clean {c.is_clean ? '✓' : '✗'}</span>
                      <span>Towels {c.towels_stocked ? '✓' : '✗'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2">Area</th>
                <th className="text-left py-2">By</th>
                <th className="text-right py-2">Temp</th>
                <th className="text-center py-2">Clean</th>
                <th className="text-center py-2">Towels</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const p = pools.find((x) => x.id === c.pool_id);
                const meta = getPoolTypeMeta(p?.type);
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3">{c.check_date} {c.check_time}</td>
                    <td>{meta.icon} {p?.name || c.pool_id}</td>
                    <td className="text-gray-600">{c.checked_by || '—'}</td>
                    <td className="text-right font-mono">{c.temperature ?? '—'}°C</td>
                    <td className="text-center">{c.is_clean ? '✓' : '✗'}</td>
                    <td className="text-center">{c.towels_stocked ? '✓' : '✗'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </>
        )}
      </Card>

      <SteamCheckModal open={checkModal} onClose={() => setCheckModal(false)} pools={pools} onSaved={load} />
    </div>
  );
}
