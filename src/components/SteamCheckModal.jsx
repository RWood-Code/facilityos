import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Modal, Field, Input, Select, Textarea, Btn } from './ui';
import { isSteamCheckArea } from '../utils/poolUtils';

export default function SteamCheckModal({ open, onClose, pools, onSaved }) {
  const { toast, currentStaff } = useAppStore();
  const steamAreas = (pools || []).filter((p) => isSteamCheckArea(p.type));
  const today = format(new Date(), 'yyyy-MM-dd');
  const [entry, setEntry] = useState({
    pool_id: '',
    check_date: today,
    check_time: format(new Date(), 'HH:mm'),
    temperature: '',
    humidity: '',
    patron_count: '',
    is_clean: true,
    towels_stocked: true,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && steamAreas.length === 1) {
      setEntry((e) => ({ ...e, pool_id: steamAreas[0].id }));
    }
  }, [open, steamAreas]);

  const set = (k, v) => setEntry((x) => ({ ...x, [k]: v }));

  async function save(e) {
    e?.preventDefault();
    if (!entry.pool_id) {
      toast('Select steam room or sauna', 'warn');
      return;
    }
    setSaving(true);
    try {
      await dbQuery('steamchecks:create', {
        ...entry,
        checked_by: currentStaff?.name || null,
        temperature: entry.temperature ? parseFloat(entry.temperature) : null,
        humidity: entry.humidity ? parseFloat(entry.humidity) : null,
        patron_count: entry.patron_count ? parseInt(entry.patron_count, 10) : null,
      });
      toast('Steam / sauna check saved');
      onSaved?.();
      onClose();
    } catch {
      toast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal title="Steam / Sauna Check" onClose={onClose} size="md">
      <form onSubmit={save}>
        <p className="text-xs text-gray-500 mb-4">
          For heated spa pools with water chemistry, use <strong>Pool water test</strong> instead.
        </p>
        {steamAreas.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
            No steam room or sauna configured. Add one in Settings → Pools (type: Steam Room or Sauna).
          </p>
        ) : (
          <>
            <Field label="Area" required>
              <Select value={entry.pool_id} onChange={(e) => set('pool_id', e.target.value)}>
                <option value="">Select…</option>
                {steamAreas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type === 'steam_room' ? 'Steam room' : 'Sauna'})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" value={entry.check_date} onChange={(e) => set('check_date', e.target.value)} /></Field>
              <Field label="Time"><Input type="time" value={entry.check_time} onChange={(e) => set('check_time', e.target.value)} /></Field>
              <Field label="Temp °C"><Input type="number" value={entry.temperature} onChange={(e) => set('temperature', e.target.value)} /></Field>
              <Field label="Humidity %"><Input type="number" value={entry.humidity} onChange={(e) => set('humidity', e.target.value)} /></Field>
              <Field label="Patrons"><Input type="number" value={entry.patron_count} onChange={(e) => set('patron_count', e.target.value)} /></Field>
            </div>
            <div className="flex gap-4 my-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={entry.is_clean} onChange={(e) => set('is_clean', e.target.checked)} /> Clean
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={entry.towels_stocked} onChange={(e) => set('towels_stocked', e.target.checked)} /> Towels stocked
              </label>
            </div>
            <Field label="Notes"><Textarea value={entry.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={saving || steamAreas.length === 0}>{saving ? 'Saving…' : 'Save check'}</Btn>
        </div>
      </form>
    </Modal>
  );
}
