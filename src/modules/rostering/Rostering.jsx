import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, addDays, parseISO, addWeeks, subWeeks } from 'date-fns';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { downloadCsv } from '../../utils/download';
import { PageHeader, Card, Btn, Field, Input, Select, TabBar, Spinner, Modal, StatusBadge } from '../../components/ui';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function generateRecurDates(startDate, recurType, endDate) {
  if (!recurType || recurType === 'none' || !endDate) return [startDate];
  const dates = [];
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1);
  let current = new Date(startDate);
  const startDay = current.getDay();

  while (current < end && dates.length < 90) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().slice(0, 10);

    if (recurType === 'daily') {
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    } else if (recurType === 'weekly') {
      if (dayOfWeek === startDay) dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    } else if (recurType === 'fortnightly') {
      dates.push(dateStr);
      current.setDate(current.getDate() + 14);
    } else if (recurType === 'weekdays') {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    } else {
      break;
    }
  }
  return dates.length ? dates : [startDate];
}

function weekRange(anchor) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return {
    start,
    end,
    week_start: format(start, 'yyyy-MM-dd'),
    week_end: format(end, 'yyyy-MM-dd'),
    days: DAY_LABELS.map((label, i) => ({ label, date: format(addDays(start, i), 'yyyy-MM-dd') })),
  };
}

export default function Rostering() {
  const { toast, currentStaff } = useAppStore();
  const [anchor, setAnchor] = useState(new Date());
  const [tab, setTab] = useState('schedule');
  const [view, setView] = useState('location');
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [leave, setLeave] = useState([]);
  const [offers, setOffers] = useState([]);
  const [shiftModal, setShiftModal] = useState(null);
  const [bulkStaff, setBulkStaff] = useState('');
  const [payrollModal, setPayrollModal] = useState(false);
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');

  const week = useMemo(() => weekRange(anchor), [anchor]);

  useEffect(() => {
    setPayFrom(week.week_start);
    setPayTo(week.week_end);
  }, [week.week_start, week.week_end]);

  function load() {
    setLoading(true);
    Promise.all([
      dbQuery('roster:locations'),
      dbQuery('roster:roles'),
      dbQuery('staff:list', { status: 'active' }),
      dbQuery('roster:shifts', { week_start: week.week_start, week_end: week.week_end }),
      dbQuery('roster:assignments', { week_start: week.week_start, week_end: week.week_end }),
      dbQuery('roster:open_shifts', { week_start: week.week_start, week_end: week.week_end }),
      dbQuery('roster:leave_list'),
      dbQuery('roster:offers', { status: 'pending' }),
    ]).then(([loc, rol, st, sh, asg, open, lv, off]) => {
      setLocations(loc || []);
      setRoles(rol || []);
      setStaff(st || []);
      setShifts(sh || []);
      setAssignments(asg || []);
      setOpenShifts(open || []);
      setLeave(lv || []);
      setOffers(off || []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [week.week_start]);

  const assignByShift = useMemo(() => {
    const m = {};
    assignments.forEach((a) => {
      if (!m[a.shift_id]) m[a.shift_id] = [];
      m[a.shift_id].push(a);
    });
    return m;
  }, [assignments]);

  async function publishWeek() {
    await dbQuery('roster:publish_week', { week_start: week.week_start, week_end: week.week_end });
    toast('Roster published to team');
    load();
  }

  async function seedWeek() {
    const r = await dbQuery('roster:seed_week', { week_start: week.week_start });
    toast(r.seeded ? `Created ${r.seeded} template shifts` : r.message || 'Done', 'info');
    load();
  }

  async function exportRoster() {
    const r = await dbQuery('export:roster', { week_start: week.week_start, week_end: week.week_end });
    downloadCsv(r);
    toast('Roster exported');
  }

  async function bulkFill() {
    if (!bulkStaff || !openShifts.length) return;
    await dbQuery('roster:bulk_assign', { shift_ids: openShifts.map((s) => s.id), staff_id: bulkStaff });
    toast('Open shifts assigned');
    load();
  }

  async function saveShift(form) {
    if (form.id) {
      await dbQuery('roster:shift_update', form);
      setShiftModal(null);
      load();
      return;
    }
    const dates = generateRecurDates(form.shift_date, form.recur_type, form.recur_end);
    for (const date of dates) {
      const { recur_type, recur_end, ...payload } = form;
      await dbQuery('roster:shift_create', { ...payload, shift_date: date });
    }
    toast(`${dates.length} shift${dates.length > 1 ? 's' : ''} created`);
    setShiftModal(null);
    load();
  }

  async function assignStaff(shiftId, staffId) {
    await dbQuery('roster:assign', { shift_id: shiftId, staff_id: staffId });
    toast('Assigned');
    load();
  }

  async function reviewLeave(id, status) {
    await dbQuery('roster:leave_review', { id, status, reviewed_by: currentStaff?.name });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Staff Rostering"
        subtitle="Beta — RosterIT-style scheduling: shifts, leave, swaps, smart matching"
        badge="Beta"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Btn variant="secondary" size="sm" onClick={() => setAnchor(subWeeks(anchor, 1))}>← Week</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setAnchor(new Date())}>Today</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setAnchor(addWeeks(anchor, 1))}>Week →</Btn>
            <Btn variant="secondary" size="sm" onClick={exportRoster}>Export</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setPayrollModal(true)}>Payroll export</Btn>
            <Btn variant="secondary" size="sm" onClick={seedWeek}>Seed template</Btn>
            <Btn size="sm" onClick={publishWeek}>Publish week</Btn>
            <Btn size="sm" onClick={() => setShiftModal({ shift_date: week.week_start, start_time: '09:00', end_time: '17:00', status: 'draft', is_open: 1 })}>+ Shift</Btn>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-sm text-gray-500">Week {week.week_start} — {week.week_end}</span>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">{openShifts.length} open shifts</span>
        <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">{offers.length} swap offers</span>
      </div>

      <TabBar
        tabs={[
          { value: 'schedule', label: 'Schedule' },
          { value: 'open', label: 'Fill shifts', badge: openShifts.length || null },
          { value: 'leave', label: 'Leave' },
          { value: 'swaps', label: 'Swaps', badge: offers.length || null },
          { value: 'timesheets', label: 'Timesheets' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? <Spinner /> : (
        <>
          {tab === 'schedule' && (
            <>
              <div className="flex gap-2 mb-3">
                {[['location', 'By location'], ['staff', 'By staff']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setView(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg ${view === v ? 'bg-slate-800 text-white' : 'bg-gray-100'}`}>{l}</button>
                ))}
              </div>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-xs min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left p-2 w-32 sticky left-0 bg-slate-50">{view === 'location' ? 'Location' : 'Staff'}</th>
                      {week.days.map((d) => (
                        <th key={d.date} className="p-2 text-center min-w-[100px]">
                          <div className="font-semibold">{d.label}</div>
                          <div className="text-gray-400 font-normal">{d.date.slice(5)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(view === 'location' ? locations : staff).map((row) => (
                      <tr key={row.id} className="border-b border-gray-50">
                        <td className="p-2 font-medium sticky left-0 bg-white">{row.name || `${row.first_name} ${row.last_name}`}</td>
                        {week.days.map((d) => {
                          const dayShifts = shifts.filter((s) => s.shift_date === d.date && (
                            view === 'location' ? s.location_id === row.id : assignByShift[s.id]?.some((a) => a.staff_id === row.id)
                          ));
                          return (
                            <td key={d.date} className="p-1 align-top">
                              {dayShifts.map((s) => {
                                const asg = assignByShift[s.id] || [];
                                const names = asg.map((a) => staff.find((st) => st.id === a.staff_id)).filter(Boolean);
                                return (
                                  <button key={s.id} type="button" onClick={() => setShiftModal(s)}
                                    className="w-full text-left mb-1 p-1.5 rounded-lg border border-gray-200 hover:border-cyan-400 bg-white"
                                    style={{ borderLeftColor: s.role_color || '#0891b2', borderLeftWidth: 3 }}>
                                    <div className="font-medium">{s.start_time}–{s.end_time}</div>
                                    <div className="text-gray-500 truncate">{view === 'location' ? (names[0] ? `${names[0].first_name}` : 'Open') : s.location_name}</div>
                                    <StatusBadge status={s.status} />
                                  </button>
                                );
                              })}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {tab === 'open' && (
            <Card>
              <p className="text-sm text-gray-600 mb-3">Bulk assign matching staff to all open shifts (smart match by role).</p>
              <div className="flex gap-2 mb-4">
                <Select className="max-w-xs" value={bulkStaff} onChange={(e) => setBulkStaff(e.target.value)}>
                  <option value="">Select staff…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </Select>
                <Btn onClick={bulkFill} disabled={!bulkStaff}>Fill all open</Btn>
              </div>
              <div className="space-y-2">
                {openShifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{s.shift_date}</span> {s.start_time}–{s.end_time} · {s.location_name} · {s.role_name}
                    </div>
                    <MatchAssign shiftId={s.id} staff={staff} onAssign={assignStaff} />
                  </div>
                ))}
                {openShifts.length === 0 && <p className="text-gray-400 text-sm">No open shifts this week</p>}
              </div>
            </Card>
          )}

          {tab === 'leave' && (
            <Card>
              <div className="mb-4">
                <Btn size="sm" variant="secondary" onClick={async () => {
                  const staffId = bulkStaff || staff[0]?.id;
                  if (!staffId) { toast('Select staff in Fill shifts tab first', 'warn'); return; }
                  await dbQuery('roster:leave_create', {
                    staff_id: staffId,
                    leave_type: 'annual',
                    start_date: week.week_start,
                    end_date: week.week_end,
                    notes: 'Requested via FacilityOS',
                  });
                  toast('Leave request submitted');
                  load();
                }}>+ Request leave (demo)</Btn>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left py-2">Staff</th><th>Type</th><th>Dates</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {leave.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-2">{l.first_name} {l.last_name}</td>
                      <td>{l.leave_type}</td>
                      <td>{l.start_date} → {l.end_date}</td>
                      <td><StatusBadge status={l.status === 'approved' ? 'completed' : l.status === 'pending' ? 'open' : 'cancelled'} /></td>
                      <td className="text-right">
                        {l.status === 'pending' && (
                          <>
                            <Btn size="sm" variant="ghost" onClick={() => reviewLeave(l.id, 'approved')}>Approve</Btn>
                            <Btn size="sm" variant="danger" onClick={() => reviewLeave(l.id, 'declined')}>Decline</Btn>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === 'swaps' && (
            <Card>
              {offers.length === 0 ? <p className="text-gray-400 text-sm">No pending shift offers</p> : offers.map((o) => (
                <div key={o.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span>{o.shift_date} {o.start_time} — {o.from_first} → {o.to_first}</span>
                  <div className="flex gap-2">
                    <Btn size="sm" onClick={() => dbQuery('roster:offer_respond', { id: o.id, accept: true }).then(load)}>Accept</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => dbQuery('roster:offer_respond', { id: o.id, accept: false }).then(load)}>Decline</Btn>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {tab === 'timesheets' && <TimesheetsTab week={week} staff={staff} />}
        </>
      )}

      {shiftModal && (
        <ShiftModal
          shift={shiftModal}
          locations={locations}
          roles={roles}
          staff={staff}
          onClose={() => setShiftModal(null)}
          onSave={saveShift}
          onAssign={assignStaff}
          onMatch={(id) => dbQuery('roster:match_staff', { shift_id: id })}
        />
      )}

      {payrollModal && (
        <Modal title="Payroll export" onClose={() => setPayrollModal(false)}>
          <Field label="Pay period from">
            <Input type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} />
          </Field>
          <Field label="Pay period to">
            <Input type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
          </Field>
          <p className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            Includes staff name, shift times, hours, pay rate, and estimated pay. Import into Xero, MYOB, or PaySauce.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Btn variant="secondary" onClick={() => setPayrollModal(false)}>Cancel</Btn>
            <Btn onClick={async () => {
              const r = await dbQuery('export:payroll', { week_start: payFrom, week_end: payTo });
              downloadCsv(r);
              setPayrollModal(false);
              toast('Payroll CSV downloaded');
            }}>Export payroll CSV</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MatchAssign({ shiftId, staff, onAssign }) {
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    dbQuery('roster:match_staff', { shift_id: shiftId }).then(setMatches);
  }, [shiftId]);
  const top = matches[0];
  return top ? (
    <Btn size="sm" onClick={() => onAssign(shiftId, top.id)}>Assign {top.first_name}</Btn>
  ) : (
    <Select className="text-xs w-32" onChange={(e) => e.target.value && onAssign(shiftId, e.target.value)}>
      <option value="">Assign…</option>
      {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
    </Select>
  );
}

function ShiftModal({ shift, locations, roles, staff, onClose, onSave, onAssign, onMatch }) {
  const [form, setForm] = useState({ ...shift, is_open: shift.is_open ? 1 : 0 });
  const [matches, setMatches] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.id) onMatch(form.id).then(setMatches);
  }, [form.id]);

  return (
    <Modal title={form.id ? 'Edit shift' : 'New shift'} onClose={onClose} size="lg">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={form.shift_date} onChange={(e) => set('shift_date', e.target.value)} /></Field>
        <Field label="Location"><Select value={form.location_id || ''} onChange={(e) => set('location_id', e.target.value)}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select></Field>
        <Field label="Role"><Select value={form.role_id || ''} onChange={(e) => set('role_id', e.target.value)}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select></Field>
        <Field label="Start"><Input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
        <Field label="End"><Input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} /></Field>
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
      {matches.length > 0 && (
        <div className="mt-3 p-3 bg-cyan-50 rounded-lg text-sm">
          <div className="font-medium mb-1">Smart match (role + availability)</div>
          {matches.slice(0, 5).map((m) => (
            <button key={m.id} type="button" className="block w-full text-left py-1 hover:text-cyan-700"
              onClick={() => onAssign(form.id, m.id)}>
              {m.first_name} {m.last_name} — score {m.matchScore}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)}>Save shift</Btn>
      </div>
    </Modal>
  );
}

function TimesheetsTab({ week, staff }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    dbQuery('roster:timesheets', { week_start: week.week_start, week_end: week.week_end }).then(setEntries);
  }, [week.week_start]);
  return (
    <Card>
      <p className="text-sm text-gray-500 mb-3">Weekly timesheet summary (beta — payroll export via roster CSV).</p>
      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm">No timesheet entries — clock hours from published shifts in a future update.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-xs text-gray-500"><th className="text-left py-2">Staff</th><th>Date</th><th className="text-right">Hours</th><th>Status</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-50">
                <td className="py-2">{e.first_name} {e.last_name}</td>
                <td>{e.work_date}</td>
                <td className="text-right font-mono">{e.hours}</td>
                <td><StatusBadge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
