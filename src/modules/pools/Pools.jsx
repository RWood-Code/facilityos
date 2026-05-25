import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, ComplianceBadge, Btn, Modal, Spinner, Empty, TabBar } from '../../components/ui';
import TestEntryModal from '../../components/TestEntryModal';
import CustomLimitsEditor from '../../components/CustomLimitsEditor';
import { checkParam, checkOverallCompliance } from '../../utils/compliance';
import {
  parseCustomLimits,
  isWaterTestPool,
  getPoolTypeMeta,
  limitsToForm,
  formToLimits,
} from '../../utils/poolUtils';
import { format } from 'date-fns';

const POOL_ORDER = ['Main Pool', 'Hydrotherapy Pool', 'Leisure Pool', 'Learners Pool', 'Spa Pool'];

function PoolHistoryPanel({ pool, onClose }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('routine');
  const customLimits = parseCustomLimits(pool.custom_limits);

  useEffect(() => {
    dbQuery('tests:list', { pool_id: pool.id, limit: 100 }).then((t) => {
      setTests(t || []);
      setLoading(false);
    });
  }, [pool.id]);

  const filtered = tests.filter((t) => t.test_type === tab);

  return (
    <Modal title={`${pool.name} — Test History`} onClose={onClose} size="xl">
      <TabBar tabs={[{ value: 'routine', label: 'Routine Tests' }, { value: 'water_balance', label: 'Water Balance' }]} active={tab} onChange={setTab} />
      {loading ? <Spinner /> : filtered.length === 0 ? <Empty icon="🧪" title="No tests recorded" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500 uppercase">
                <th className="text-left py-2 pr-3">Date</th>
                <th className="text-right py-2 pr-3">FAC</th>
                <th className="text-right py-2 pr-3">pH</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="py-2">{t.test_date} {t.test_time}</td>
                  <td className="text-right font-mono">{t.free_chlorine ?? '—'}</td>
                  <td className="text-right font-mono">{t.ph ?? '—'}</td>
                  <td><ComplianceBadge compliant={checkOverallCompliance(t, pool.type, customLimits)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function LimitsModal({ pool, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [limitForm, setLimitForm] = useState(() => limitsToForm(pool.custom_limits));

  async function save() {
    const custom_limits = formToLimits(limitForm);
    await dbQuery('pools:update', { id: pool.id, custom_limits });
    toast('Custom limits saved');
    onSaved();
    onClose();
  }

  return (
    <Modal title={`Custom limits — ${pool.name}`} onClose={onClose} size="lg">
      <CustomLimitsEditor poolType={pool.type} limitForm={limitForm} setLimitForm={setLimitForm} />
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save limits</Btn>
      </div>
    </Modal>
  );
}

export default function Pools() {
  const { toast, setSelectedPoolId, setModule } = useAppStore();
  const [pools, setPools] = useState([]);
  const [latestTests, setLatestTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testModal, setTestModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [historyPool, setHistoryPool] = useState(null);
  const [limitsPool, setLimitsPool] = useState(null);
  const [refresh, setRefresh] = useState(0);

  function load() {
    setLoading(true);
    Promise.all([dbQuery('pools:list'), dbQuery('tests:latest_per_pool')])
      .then(([p, t]) => {
        const sorted = [...(p || [])].sort((a, b) => POOL_ORDER.indexOf(a.name) - POOL_ORDER.indexOf(b.name));
        setPools(sorted);
        setLatestTests(t || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [refresh]);

  const waterPools = pools.filter((p) => isWaterTestPool(p.type));
  const getLatest = (poolId) => latestTests.find((t) => t.pool_id === poolId);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Pool Management"
        subtitle="Water chemistry for pools and spa pools (NZS 5826) — steam rooms & saunas use Steam & Sauna module"
        actions={<Btn onClick={() => { setSelectedPool(null); setTestModal(true); }}>+ Record Test</Btn>}
      />

      <div className="grid grid-cols-1 gap-4">
        {waterPools.length === 0 ? (
          <Empty icon="🏊" title="No pools or spas configured" desc="Add pools in Settings → Pools" />
        ) : (
          waterPools.map((pool) => {
            const latest = getLatest(pool.id);
            const customLimits = parseCustomLimits(pool.custom_limits);
            const meta = getPoolTypeMeta(pool.type);
            const compliant = latest ? checkOverallCompliance(latest, pool.type, customLimits) : null;
            return (
              <div key={pool.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <div
                        className="font-semibold text-gray-900 cursor-pointer hover:text-cyan-600 transition-colors"
                        onClick={() => { setSelectedPoolId(pool.id); setModule('poolhistory'); }}
                      >
                        {pool.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {meta.label}
                        {pool.volume_litres ? ` · ${(pool.volume_litres / 1000).toFixed(0)} kL` : ''}
                        {customLimits && Object.keys(customLimits).length > 0 ? ' · Custom limits' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ComplianceBadge compliant={compliant} />
                    <Btn variant="ghost" size="sm" onClick={() => setLimitsPool(pool)}>Limits</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => setHistoryPool(pool)}>History</Btn>
                    <Btn size="sm" onClick={() => { setSelectedPool(pool); setTestModal(true); }}>+ Test</Btn>
                  </div>
                </div>
                {latest && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 grid grid-cols-5 gap-3">
                    {[['FAC', 'free_chlorine', 'mg/L'], ['pH', 'ph', ''], ['Temp', 'temperature', '°C'], ['TA', 'total_alkalinity', 'mg/L'], ['By', 'tested_by', '']].map(([l, k, u]) => (
                      <div key={k}>
                        <div className="text-xs text-gray-400">{l}</div>
                        <div className={`text-sm font-semibold ${k !== 'tested_by' && checkParam(k, latest[k], pool.type, customLimits) === false ? 'text-red-600' : 'text-gray-800'}`}>
                          {latest[k] != null ? `${latest[k]}${u ? ` ${u}` : ''}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {testModal && (
        <TestEntryModal
          open={testModal}
          onClose={() => setTestModal(false)}
          pool={selectedPool}
          pools={waterPools}
          onSaved={() => setRefresh((r) => r + 1)}
        />
      )}
      {historyPool && <PoolHistoryPanel pool={historyPool} onClose={() => setHistoryPool(null)} />}
      {limitsPool && <LimitsModal pool={limitsPool} onClose={() => setLimitsPool(null)} onSaved={() => setRefresh((r) => r + 1)} />}
    </div>
  );
}
