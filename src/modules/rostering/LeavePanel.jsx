import React, { useState } from 'react';
import { Card, Btn, StatusBadge, Modal, Field, Input, Select, Textarea } from '../../components/ui';

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'lwop', label: 'Leave without pay' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'other', label: 'Other' },
];

export default function LeavePanel({ leave, staff, onReview, onCreate }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">Manage leave requests and approvals.</p>
        <Btn size="sm" onClick={() => setShowForm(true)}>+ Request leave</Btn>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b">
            <th className="text-left py-2">Staff</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Hours</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {leave.map((l) => (
            <tr key={l.id} className="border-b border-gray-50">
              <td className="py-2">{l.first_name} {l.last_name}</td>
              <td className="capitalize">{l.leave_type?.replace('_', ' ')}</td>
              <td>{l.start_date} → {l.end_date}</td>
              <td className="font-mono">{l.hours ?? '—'}</td>
              <td>
                <StatusBadge status={l.status === 'approved' ? 'completed' : l.status === 'pending' ? 'open' : 'cancelled'} />
              </td>
              <td className="text-right">
                {l.status === 'pending' && (
                  <>
                    <Btn size="sm" variant="ghost" onClick={() => onReview(l.id, 'approved')}>Approve</Btn>
                    <Btn size="sm" variant="danger" onClick={() => onReview(l.id, 'declined')}>Decline</Btn>
                  </>
                )}
              </td>
            </tr>
          ))}
          {leave.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-gray-400">No leave requests</td></tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <LeaveFormModal staff={staff} onClose={() => setShowForm(false)} onSave={async (form) => {
          await onCreate(form);
          setShowForm(false);
        }} />
      )}
    </Card>
  );
}

function LeaveFormModal({ staff, onClose, onSave }) {
  const [form, setForm] = useState({
    staff_id: staff[0]?.id || '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    hours: '',
    notes: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title="Request leave" onClose={onClose}>
      <Field label="Staff" required>
        <Select value={form.staff_id} onChange={(e) => set('staff_id', e.target.value)}>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </Select>
      </Field>
      <Field label="Leave type">
        <Select value={form.leave_type} onChange={(e) => set('leave_type', e.target.value)}>
          {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" required><Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
        <Field label="End date" required><Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
      </div>
      <Field label="Hours (optional)"><Input type="number" step="0.5" value={form.hours} onChange={(e) => set('hours', e.target.value ? parseFloat(e.target.value) : null)} /></Field>
      <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={!form.staff_id || !form.start_date || !form.end_date}>Submit</Btn>
      </div>
    </Modal>
  );
}
