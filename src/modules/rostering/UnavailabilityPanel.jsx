import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { Card, Btn, Field, Input, Select, Modal } from '../../components/ui';

export default function UnavailabilityPanel({ staff }) {
  const { toast } = useAppStore();
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);

  function load() {
    dbQuery('roster:unavailability').then(setEntries);
  }

  useEffect(() => { load(); }, []);

  async function create(form) {
    await dbQuery('roster:unavailability_create', form);
    toast('Unavailability recorded');
    setShowForm(false);
    load();
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">Staff blackout dates — used by smart match when filling shifts.</p>
        <Btn size="sm" onClick={() => setShowForm(true)}>+ Add unavailability</Btn>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b">
            <th className="text-left py-2">Staff</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-gray-50">
              <td className="py-2">{e.first_name} {e.last_name}</td>
              <td>{e.start_date}</td>
              <td>{e.end_date}</td>
              <td className="text-gray-500">{e.reason || '—'}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-gray-400">No unavailability recorded</td></tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <UnavailModal staff={staff} onClose={() => setShowForm(false)} onSave={create} />
      )}
    </Card>
  );
}

function UnavailModal({ staff, onClose, onSave }) {
  const [form, setForm] = useState({
    staff_id: staff[0]?.id || '',
    start_date: '',
    end_date: '',
    reason: '',
    all_day: true,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title="Add unavailability" onClose={onClose}>
      <Field label="Staff" required>
        <Select value={form.staff_id} onChange={(e) => set('staff_id', e.target.value)}>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date"><Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
        <Field label="End date"><Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
      </div>
      <Field label="Reason"><Input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Uni exams" /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave({ ...form, all_day: 1 })}>Save</Btn>
      </div>
    </Modal>
  );
}
