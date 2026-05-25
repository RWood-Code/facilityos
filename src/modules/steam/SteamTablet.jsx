import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { Btn, Spinner } from '../../components/ui';
import { isSteamCheckArea, getPoolTypeMeta } from '../../utils/poolUtils';

function QuickCheckForm({ area, onSaved, onCancel }) {
  const { toast, currentStaff } = useAppStore();
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = format(new Date(), 'HH:mm');
  const [entry, setEntry] = useState({
    is_clean: true,
    towels_stocked: true,
    temperature: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await dbQuery('steamchecks:create', {
        pool_id: area.id,
        check_date: today,
        check_time: now,
        checked_by: currentStaff?.name || 'Steam tablet',
        is_clean: entry.is_clean,
        towels_stocked: entry.towels_stocked,
        temperature: entry.temperature ? parseFloat(entry.temperature) : null,
        notes: entry.notes || null,
      });
      toast('Check saved');
      onSaved?.();
    } catch {
      toast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-600 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{area.name}</h3>
        <button type="button" className="text-slate-400 text-sm" onClick={onCancel}>Back</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setEntry((e) => ({ ...e, is_clean: !e.is_clean }))}
          className={`min-h-[72px] rounded-xl text-lg font-semibold border-2 transition-all
            ${entry.is_clean ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-700 border-slate-500 text-slate-300'}`}
        >
          {entry.is_clean ? '✓ Clean' : '✗ Not clean'}
        </button>
        <button
          type="button"
          onClick={() => setEntry((e) => ({ ...e, towels_stocked: !e.towels_stocked }))}
          className={`min-h-[72px] rounded-xl text-lg font-semibold border-2 transition-all
            ${entry.towels_stocked ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-700 border-slate-500 text-slate-300'}`}
        >
          {entry.towels_stocked ? '✓ Towels OK' : '✗ Towels low'}
        </button>
      </div>
      <label className="block text-sm text-slate-300">
        Temp °C (optional)
        <input
          type="number"
          inputMode="decimal"
          value={entry.temperature}
          onChange={(e) => setEntry((x) => ({ ...x, temperature: e.target.value }))}
          className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-600 px-4 py-3 text-white text-lg min-h-[48px]"
        />
      </label>
      <Btn className="w-full min-h-[52px] text-base" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save check'}
      </Btn>
    </div>
  );
}

export default function SteamTablet({ onExit }) {
  const { settings } = useAppStore();
  const [pools, setPools] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState(null);
  const [clock, setClock] = useState(format(new Date(), 'HH:mm'));

  const steamAreas = pools.filter((p) => isSteamCheckArea(p.type));

  function load() {
    setLoading(true);
    Promise.all([dbQuery('pools:list'), dbQuery('steamchecks:list', { limit: 12 })])
      .then(([p, c]) => {
        setPools(p || []);
        setChecks(c || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date(), 'HH:mm')), 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white safe-area-pad">
      <header className="flex items-center justify-between px-4 py-4 border-b border-slate-700/80">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest">Steam & Sauna</div>
          <div className="text-lg font-bold">{settings.facility_name || 'FacilityOS'}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold text-cyan-400">{clock}</div>
          <div className="text-xs text-slate-500">{format(new Date(), 'EEE d MMM')}</div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
        {selectedArea ? (
          <QuickCheckForm
            area={selectedArea}
            onSaved={() => { setSelectedArea(null); load(); }}
            onCancel={() => setSelectedArea(null)}
          />
        ) : (
          <>
            {steamAreas.length === 0 ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-100 text-sm">
                No steam room or sauna configured. Add one in Settings → Pools on the server PC.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {steamAreas.map((area) => {
                  const meta = getPoolTypeMeta(area.type);
                  const last = checks.find((c) => c.pool_id === area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setSelectedArea(area)}
                      className="min-h-[120px] rounded-2xl bg-gradient-to-br from-cyan-600 to-cyan-800 p-5 text-left shadow-lg active:scale-[0.98] transition-transform"
                    >
                      <div className="text-3xl mb-2">{meta.icon}</div>
                      <div className="text-xl font-bold">{area.name}</div>
                      <div className="text-sm text-cyan-100/80 mt-1">
                        {last ? `Last: ${last.check_date} ${last.check_time}` : 'Tap to log check'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {checks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Recent checks</h3>
                <div className="space-y-2">
                  {checks.slice(0, 8).map((c) => {
                    const p = pools.find((x) => x.id === c.pool_id);
                    return (
                      <div key={c.id} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3 text-sm">
                        <span>{p?.name || c.pool_id}</span>
                        <span className="text-slate-400 font-mono">{c.check_date} {c.check_time}</span>
                        <span className="text-emerald-400">{c.is_clean ? '✓' : '✗'} {c.towels_stocked ? '✓' : '✗'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 p-4 safe-area-bottom">
        <button
          type="button"
          onClick={onExit}
          className="w-full max-w-2xl mx-auto block text-center text-xs text-slate-500 py-3"
        >
          Exit tablet mode
        </button>
      </footer>
    </div>
  );
}
