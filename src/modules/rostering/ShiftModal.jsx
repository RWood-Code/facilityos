import React, { useState, useEffect } from 'react';

import { dbQuery } from '../../hooks/useDb';

import { Modal, Field, Input, Select, Btn, Textarea } from '../../components/ui';

import { computeShiftHours } from './rosterUtils';



export default function ShiftModal({

  shift,

  locations,

  roles,

  staff,

  payComponents,

  assignments = [],

  onClose,

  onSave,

  onAssign,

  onUnassign,

  onDelete,

  onOffer,

  onMatch,

}) {

  const [form, setForm] = useState({

    ...shift,

    is_open: shift.is_open ? 1 : 0,

    break_minutes: shift.break_minutes ?? 30,

    headcount: shift.headcount ?? 1,

  });

  const [matches, setMatches] = useState([]);

  const [payPreview, setPayPreview] = useState(null);

  const [conflicts, setConflicts] = useState([]);

  const [selectedStaff, setSelectedStaff] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));



  const headcount = Math.max(1, parseInt(form.headcount, 10) || 1);

  const slotsLeft = Math.max(0, headcount - assignments.length);

  const assignedIds = new Set(assignments.map((a) => a.staff_id));

  const availableStaff = staff.filter((s) => !assignedIds.has(s.id));

  const hours = computeShiftHours(form.start_time, form.end_time, form.break_minutes || 0);



  useEffect(() => {

    if (form.id) onMatch(form.id).then(setMatches);

  }, [form.id]);



  useEffect(() => {

    const previewStaff = selectedStaff || assignments[0]?.staff_id;

    if (!previewStaff || !form.pay_component_id) {

      setPayPreview(null);

      return;

    }

    dbQuery('roster:resolve_pay', {

      shift_id: form.id,

      staff_id: previewStaff,

      pay_component_id: form.pay_component_id,

    }).then(setPayPreview);

  }, [form.id, form.pay_component_id, form.start_time, form.end_time, form.break_minutes, selectedStaff, assignments]);



  useEffect(() => {

    const previewStaff = selectedStaff || assignments[0]?.staff_id;

    if (!previewStaff || !form.shift_date) {

      setConflicts([]);

      return;

    }

    dbQuery('roster:staff_conflicts', {

      staff_id: previewStaff,

      shift_date: form.shift_date,

      start_time: form.start_time,

      end_time: form.end_time,

      exclude_shift_id: form.id,

    }).then(setConflicts);

  }, [selectedStaff, assignments, form.shift_date, form.start_time, form.end_time, form.id]);



  function handleRoleChange(roleId) {

    const role = roles.find((r) => r.id === roleId);

    set('role_id', roleId);

    if (role?.default_pay_component_id && !form.pay_component_id) {

      set('pay_component_id', role.default_pay_component_id);

    }

  }



  async function save() {

    if (!form.pay_component_id || !form.location_id || !form.role_id) return;

    await onSave(form);

  }



  async function handleAssign(replace = false) {

    if (!selectedStaff || !form.id) return;

    await onAssign(form.id, selectedStaff, { replace });

    setSelectedStaff('');

  }



  return (

    <Modal title={form.id ? 'Edit shift' : 'New shift'} onClose={onClose} size="lg">

      <div className="grid grid-cols-2 gap-3">

        <Field label="Date" required>

          <Input type="date" value={form.shift_date || ''} onChange={(e) => set('shift_date', e.target.value)} />

        </Field>

        <Field label="Location" required>

          <Select value={form.location_id || ''} onChange={(e) => set('location_id', e.target.value)}>

            <option value="">Select…</option>

            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}

          </Select>

        </Field>

        <Field label="Role" required>

          <Select value={form.role_id || ''} onChange={(e) => handleRoleChange(e.target.value)}>

            <option value="">Select…</option>

            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}

          </Select>

        </Field>

        <Field label="Pay component" required>

          <Select value={form.pay_component_id || ''} onChange={(e) => set('pay_component_id', e.target.value)}>

            <option value="">Select pay code…</option>

            {payComponents.map((p) => (

              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>

            ))}

          </Select>

        </Field>

        <Field label="Start"><Input type="time" value={form.start_time || ''} onChange={(e) => set('start_time', e.target.value)} /></Field>

        <Field label="End"><Input type="time" value={form.end_time || ''} onChange={(e) => set('end_time', e.target.value)} /></Field>

        <Field label="Break (mins)"><Input type="number" min={0} value={form.break_minutes ?? 0} onChange={(e) => set('break_minutes', parseInt(e.target.value, 10) || 0)} /></Field>

        <Field label="Staff needed">

          <Input type="number" min={1} value={headcount} onChange={(e) => set('headcount', parseInt(e.target.value, 10) || 1)} />

          <p className="text-[10px] text-gray-500 mt-1">Set to 2+ to assign multiple staff to one shift</p>

        </Field>

        {!form.id && (

          <>

            <Field label="Repeat">

              <Select value={form.recur_type || 'none'} onChange={(e) => set('recur_type', e.target.value)}>

                <option value="none">Does not repeat</option>

                <option value="daily">Daily</option>

                <option value="weekly">Weekly (same day)</option>

                <option value="fortnightly">Fortnightly</option>

                <option value="weekdays">Every weekday (Mon–Fri)</option>

              </Select>

            </Field>

            {form.recur_type && form.recur_type !== 'none' && (

              <Field label="Repeat until">

                <Input type="date" value={form.recur_end || ''} min={form.shift_date} onChange={(e) => set('recur_end', e.target.value)} />

              </Field>

            )}

          </>

        )}

      </div>

      <Field label="Notes" className="mt-3">

        <Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Shift notes…" />

      </Field>



      <div className="mt-3 p-3 rounded-lg bg-slate-50 text-sm flex flex-wrap gap-4">

        <span><strong>{hours.toFixed(2)}</strong> hrs (after break)</span>

        {payPreview && (

          <span>Rate <strong>${payPreview.pay_rate?.toFixed(2)}</strong>/hr × {payPreview.multiplier} = <strong>${payPreview.amount?.toFixed(2)}</strong></span>

        )}

      </div>



      {conflicts.length > 0 && (

        <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700 space-y-1">

          {conflicts.map((c, i) => <div key={i}>⚠ {c.message}</div>)}

        </div>

      )}



      {form.id && (

        <div className="mt-4 border-t pt-4 space-y-3">

          <div className="flex items-center justify-between gap-2">

            <h4 className="text-sm font-semibold text-gray-900">Staff on shift</h4>

            <span className="text-xs text-gray-500">{assignments.length} / {headcount}</span>

          </div>



          {assignments.length === 0 ? (

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">No staff assigned yet</p>

          ) : (

            <ul className="space-y-1">

              {assignments.map((a) => (

                <li key={a.id} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">

                  <span>{a.first_name} {a.last_name}{a.pay_code ? ` · ${a.pay_code}` : ''}</span>

                  {onUnassign && (

                    <button

                      type="button"

                      className="text-xs text-red-600 hover:text-red-800"

                      onClick={() => onUnassign(a.id)}

                    >

                      Remove

                    </button>

                  )}

                </li>

              ))}

            </ul>

          )}



          {slotsLeft > 0 && (

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">

              <Field label={headcount === 1 ? 'Assign staff' : `Add staff (${slotsLeft} slot${slotsLeft > 1 ? 's' : ''} left)`} className="flex-1">

                <Select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>

                  <option value="">Select staff…</option>

                  {availableStaff.map((s) => (

                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>

                  ))}

                </Select>

              </Field>

              {selectedStaff && (

                <Btn size="sm" onClick={() => handleAssign(headcount === 1 && assignments.length > 0)}>

                  {headcount === 1 && assignments.length > 0 ? 'Reassign' : 'Add to shift'}

                </Btn>

              )}

            </div>

          )}



          {assignments.length === 1 && onOffer && (

            <Field label="Offer shift to">

              <Select onChange={(e) => e.target.value && onOffer(form.id, assignments[0].staff_id, e.target.value)}>

                <option value="">Select colleague…</option>

                {staff.filter((s) => s.id !== assignments[0].staff_id).map((s) => (

                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>

                ))}

              </Select>

            </Field>

          )}

        </div>

      )}



      {matches.length > 0 && form.id && slotsLeft > 0 && (

        <div className="mt-3 p-3 bg-cyan-50 rounded-lg text-sm">

          <div className="font-medium mb-1">Smart match</div>

          {matches.slice(0, 5).map((m) => (

            <button key={m.id} type="button" className="block w-full text-left py-1 hover:text-cyan-700"

              onClick={() => onAssign(form.id, m.id, { replace: headcount === 1 && assignments.length > 0 })}>

              {m.first_name} {m.last_name} — score {m.matchScore}

            </button>

          ))}

        </div>

      )}



      <div className="flex justify-between gap-2 mt-4">

        <div>

          {form.id && onDelete && (

            <Btn variant="danger" size="sm" onClick={() => onDelete(form.id)}>Delete</Btn>

          )}

        </div>

        <div className="flex gap-2">

          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>

          <Btn onClick={save} disabled={!form.pay_component_id}>Save shift</Btn>

        </div>

      </div>

    </Modal>

  );

}


