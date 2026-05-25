import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { PageHeader, Card, Field, Input, Select, Btn } from '../../components/ui';
import { calcChlorineDose, calcPhDose, calcTaDose, CHEMICALS } from '../../utils/dosing';

export default function Dosing() {
  const [pools, setPools] = useState([]);
  const [poolId, setPoolId] = useState('');
  const [tab, setTab] = useState('chlorine');
  const [result, setResult] = useState(null);

  const [chlorine, setChlorine] = useState({ current: '1.2', target: '2.0', chemical: 'liquid_chlorine' });
  const [ph, setPh] = useState({ current: '7.8', target: '7.4' });
  const [ta, setTa] = useState({ current: '70', target: '100' });

  useEffect(() => { dbQuery('pools:list').then((p) => { setPools(p || []); if (p?.[0]) setPoolId(p[0].id); }); }, []);

  const pool = pools.find((p) => p.id === poolId);
  const vol = pool?.volume_litres || 100000;

  function calculate() {
    if (tab === 'chlorine') {
      setResult(calcChlorineDose({
        volumeLitres: vol,
        currentPpm: parseFloat(chlorine.current),
        targetPpm: parseFloat(chlorine.target),
        chemicalId: chlorine.chemical,
      }));
    } else if (tab === 'ph') {
      setResult(calcPhDose({
        volumeLitres: vol,
        currentPh: parseFloat(ph.current),
        targetPh: parseFloat(ph.target),
      }));
    } else {
      setResult(calcTaDose({
        volumeLitres: vol,
        currentTa: parseFloat(ta.current),
        targetTa: parseFloat(ta.target),
      }));
    }
  }

  return (
    <div>
      <PageHeader title="Dosing Calculator" subtitle="NZS 5826 indicative chemical dosing — always verify with plant specifications" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <Field label="Pool / body of water">
            <Select value={poolId} onChange={(e) => setPoolId(e.target.value)}>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({(p.volume_litres / 1000).toFixed(0)} kL)</option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2 mb-4">
            {[['chlorine', 'Chlorine'], ['ph', 'pH'], ['ta', 'Alkalinity']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setTab(v); setResult(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === v ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
            ))}
          </div>
          {tab === 'chlorine' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current FAC (mg/L)"><Input value={chlorine.current} onChange={(e) => setChlorine((c) => ({ ...c, current: e.target.value }))} /></Field>
              <Field label="Target FAC (mg/L)"><Input value={chlorine.target} onChange={(e) => setChlorine((c) => ({ ...c, target: e.target.value }))} /></Field>
              <Field label="Chemical" className="col-span-2">
                <Select value={chlorine.chemical} onChange={(e) => setChlorine((c) => ({ ...c, chemical: e.target.value }))}>
                  {CHEMICALS.filter((c) => c.id.includes('chlorine') || c.id === 'calcium_hypo').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {tab === 'ph' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current pH"><Input value={ph.current} onChange={(e) => setPh((p) => ({ ...p, current: e.target.value }))} /></Field>
              <Field label="Target pH"><Input value={ph.target} onChange={(e) => setPh((p) => ({ ...p, target: e.target.value }))} /></Field>
            </div>
          )}
          {tab === 'ta' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current TA (mg/L)"><Input value={ta.current} onChange={(e) => setTa((t) => ({ ...t, current: e.target.value }))} /></Field>
              <Field label="Target TA (mg/L)"><Input value={ta.target} onChange={(e) => setTa((t) => ({ ...t, target: e.target.value }))} /></Field>
            </div>
          )}
          <Btn className="mt-4" onClick={calculate}>Calculate dose</Btn>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Result</h3>
          {result ? (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-cyan-700">{result.amount} <span className="text-lg font-normal">{result.unit}</span></div>
              <div className="text-sm text-gray-700">{result.chemical}</div>
              {result.note && <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">{result.note}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Enter readings and calculate</p>
          )}
          <p className="text-xs text-gray-400 mt-4 border-t pt-3">Indicative only. Follow manufacturer SDS and your aquatic risk management plan.</p>
        </Card>
      </div>
    </div>
  );
}
