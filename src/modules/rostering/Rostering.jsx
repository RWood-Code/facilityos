import React, { useState, useEffect, useMemo } from 'react';
import { addWeeks, subWeeks } from 'date-fns';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { downloadCsv } from '../../utils/download';
import { PageHeader, Btn, TabBar, Spinner } from '../../components/ui';
import { weekRange, generateRecurDates, defaultShiftSeed, shiftUpdatePayload } from './rosterUtils';
import WeekSummaryBar from './WeekSummaryBar';
import WeekGrid from './WeekGrid';
import ShiftModal from './ShiftModal';
import OpenShiftsPanel from './OpenShiftsPanel';
import LeavePanel from './LeavePanel';
import SwapsPanel from './SwapsPanel';
import TimesheetsPanel from './TimesheetsPanel';
import PayCodesPanel from './PayCodesPanel';
import UnavailabilityPanel from './UnavailabilityPanel';
import PayrollExportModal from './PayrollExportModal';

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
  const [payComponents, setPayComponents] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [leave, setLeave] = useState([]);
  const [offers, setOffers] = useState([]);
  const [summary, setSummary] = useState(null);
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
      dbQuery('roster:pay_components'),
      dbQuery('staff:list', { status: 'active' }),
      dbQuery('roster:shifts', { week_start: week.week_start, week_end: week.week_end }),
      dbQuery('roster:assignments', { week_start: week.week_start, week_end: week.week_end }),
      dbQuery('roster:open_shifts', { week_start: week.week_start, week_end: week.week_end }),
      dbQuery('roster:leave_list'),
      dbQuery('roster:offers', { status: 'pending' }),
      dbQuery('roster:week_summary', { week_start: week.week_start, week_end: week.week_end }),
    ]).then(([loc, rol, pc, st, sh, asg, open, lv, off, sum]) => {
      setLocations(loc || []);
      setRoles(rol || []);
      setPayComponents(pc || []);
      setStaff(st || []);
      setShifts(sh || []);
      setAssignments(asg || []);
      setOpenShifts(open || []);
      setLeave(lv || []);
      setOffers(off || []);
      setSummary(sum || null);
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
    const r = await dbQuery('roster:publish_week', { week_start: week.week_start, week_end: week.week_end });
    toast('Roster published — timesheets generated');
    load();
    return r;
  }

  async function copyWeek() {
    if (!window.confirm('Copy this week\'s shifts to next week (as drafts, unassigned)?')) return;
    const r = await dbQuery('roster:copy_week', { week_start: week.week_start, week_end: week.week_end });
    toast(r.copied ? `Copied ${r.copied} shifts to next week` : r.message || 'Done', 'info');
    if (r.copied) setAnchor(addWeeks(anchor, 1));
    else load();
  }

  async function clearWeek() {
    if (!window.confirm('Delete all shifts this week? This cannot be undone.')) return;
    const r = await dbQuery('roster:clear_week', { week_start: week.week_start, week_end: week.week_end });
    toast(`Removed ${r.deleted} shifts`);
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
    const { recur_type, recur_end, ...payload } = form;
    if (!payload.pay_component_id) {
      toast('Pay component is required', 'warn');
      return;
    }
    if (form.id) {
      await dbQuery('roster:shift_update', shiftUpdatePayload(form));
      setShiftModal(null);
      load();
      return;
    }
    const dates = generateRecurDates(form.shift_date, recur_type, recur_end);
    for (const date of dates) {
      await dbQuery('roster:shift_create', { ...payload, shift_date: date });
    }
    toast(`${dates.length} shift${dates.length > 1 ? 's' : ''} created`);
    setShiftModal(null);
    load();
  }

  async function assignStaff(shiftId, staffId, { replace = false } = {}) {
    const r = await dbQuery('roster:assign', { shift_id: shiftId, staff_id: staffId, replace });
    if (r?.error) {
      toast(r.message || 'Could not assign staff', 'warn');
      return;
    }
    toast(replace ? 'Reassigned' : 'Assigned');
    load();
    if (shiftModal?.id === shiftId) {
      const updated = await dbQuery('roster:assignments', { week_start: week.week_start, week_end: week.week_end });
      setAssignments(updated || []);
    }
  }

  async function unassignStaff(assignmentId) {
    await dbQuery('roster:unassign', { assignment_id: assignmentId });
    toast('Removed from shift');
    load();
    if (shiftModal?.id) {
      const updated = await dbQuery('roster:assignments', { week_start: week.week_start, week_end: week.week_end });
      setAssignments(updated || []);
    }
  }

  async function deleteShift(id) {
    if (!window.confirm('Delete this shift?')) return;
    await dbQuery('roster:shift_delete', id);
    setShiftModal(null);
    toast('Shift deleted');
    load();
  }

  async function offerShift(shiftId, fromStaffId, toStaffId) {
    await dbQuery('roster:offer_create', { shift_id: shiftId, from_staff_id: fromStaffId, to_staff_id: toStaffId });
    toast('Swap offer sent');
    load();
  }

  async function reviewLeave(id, status) {
    await dbQuery('roster:leave_review', { id, status, reviewed_by: currentStaff?.name });
    load();
  }

  function handleNewShift(date, locationId) {
    setShiftModal(defaultShiftSeed(date, locations, roles, payComponents, locationId));
  }

  return (
    <div>
      <PageHeader
        title="Staff Rostering"
        subtitle="RosterIt-style scheduling with pay codes, timesheets, and bespoke payroll export"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Btn variant="secondary" size="sm" onClick={() => setAnchor(subWeeks(anchor, 1))}>← Week</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setAnchor(new Date())}>Today</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setAnchor(addWeeks(anchor, 1))}>Week →</Btn>
            <Btn variant="secondary" size="sm" onClick={exportRoster}>Export</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setPayrollModal(true)}>Payroll export</Btn>
            <Btn variant="secondary" size="sm" onClick={copyWeek}>Copy week</Btn>
            <Btn variant="secondary" size="sm" onClick={clearWeek}>Clear week</Btn>
            <Btn variant="secondary" size="sm" onClick={seedWeek}>Seed template</Btn>
            <Btn size="sm" onClick={publishWeek}>Publish week</Btn>
            <Btn size="sm" onClick={() => handleNewShift(week.week_start, locations[0]?.id)}>+ Shift</Btn>
          </div>
        }
      />

      <WeekSummaryBar summary={summary} />

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-sm text-gray-500">Week {week.week_start} — {week.week_end}</span>
        {tab === 'schedule' && (
          <div className="flex gap-1 ml-2">
            {[['location', 'By location'], ['staff', 'By staff']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`text-xs px-3 py-1.5 rounded-lg ${view === v ? 'bg-slate-800 text-white' : 'bg-gray-100'}`}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <TabBar
        tabs={[
          { value: 'schedule', label: 'Schedule' },
          { value: 'open', label: 'Fill shifts', badge: openShifts.length || null },
          { value: 'leave', label: 'Leave' },
          { value: 'swaps', label: 'Swaps', badge: offers.length || null },
          { value: 'timesheets', label: 'Timesheets' },
          { value: 'unavailability', label: 'Unavailability' },
          { value: 'paycodes', label: 'Pay codes' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? <Spinner /> : (
        <>
          {tab === 'schedule' && (
            <WeekGrid
              week={week}
              view={view}
              locations={locations}
              staff={staff}
              shifts={shifts}
              assignByShift={assignByShift}
              onShiftClick={(s) => setShiftModal(s)}
              onNewShift={handleNewShift}
              onAssign={(shiftId, staffId, opts) => assignStaff(shiftId, staffId, opts)}
            />
          )}
          {tab === 'open' && (
            <OpenShiftsPanel
              openShifts={openShifts}
              staff={staff}
              bulkStaff={bulkStaff}
              setBulkStaff={setBulkStaff}
              onBulkFill={bulkFill}
              onAssign={(shiftId, staffId, opts) => assignStaff(shiftId, staffId, opts)}
            />
          )}
          {tab === 'leave' && (
            <LeavePanel
              leave={leave}
              staff={staff}
              onReview={reviewLeave}
              onCreate={(form) => dbQuery('roster:leave_create', form).then(() => { toast('Leave submitted'); load(); })}
            />
          )}
          {tab === 'swaps' && (
            <SwapsPanel
              offers={offers}
              onRespond={(id, accept) => dbQuery('roster:offer_respond', { id, accept }).then(load)}
            />
          )}
          {tab === 'timesheets' && (
            <TimesheetsPanel week={week} currentStaff={currentStaff} />
          )}
          {tab === 'unavailability' && <UnavailabilityPanel staff={staff} />}
          {tab === 'paycodes' && <PayCodesPanel />}
        </>
      )}

      {shiftModal && (
        <ShiftModal
          shift={shiftModal}
          locations={locations}
          roles={roles}
          staff={staff}
          payComponents={payComponents}
          assignments={assignByShift[shiftModal.id] || []}
          onClose={() => setShiftModal(null)}
          onSave={saveShift}
          onAssign={(shiftId, staffId, opts) => assignStaff(shiftId, staffId, opts)}
          onUnassign={unassignStaff}
          onDelete={shiftModal.id ? deleteShift : null}
          onOffer={offerShift}
          onMatch={(id) => dbQuery('roster:match_staff', { shift_id: id })}
        />
      )}

      {payrollModal && (
        <PayrollExportModal
          payFrom={payFrom}
          payTo={payTo}
          setPayFrom={setPayFrom}
          setPayTo={setPayTo}
          onClose={() => setPayrollModal(false)}
          onExported={() => toast('Payroll CSV downloaded')}
        />
      )}
    </div>
  );
}
