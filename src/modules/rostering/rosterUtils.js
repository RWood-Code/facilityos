import { format, startOfWeek, addDays } from 'date-fns';

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekRange(anchor) {
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

export function generateRecurDates(startDate, recurType, endDate) {
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

export function computeShiftHours(start, end, breakMin = 0) {
  const [sh, sm] = (start || '0:0').split(':').map(Number);
  const [eh, em] = (end || '0:0').split(':').map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM <= startM) endM += 24 * 60;
  return Math.max(0, (endM - startM - breakMin) / 60);
}

export function defaultShiftSeed(weekStart, locations, roles, payComponents, locationId) {
  const ord = payComponents?.find((p) => p.code === 'ORD');
  return {
    shift_date: weekStart,
    start_time: '09:00',
    end_time: '17:00',
    status: 'draft',
    is_open: 1,
    break_minutes: 30,
    headcount: 1,
    pay_component_id: ord?.id || payComponents?.[0]?.id || '',
    location_id: locationId || locations?.[0]?.id || '',
    role_id: roles?.[0]?.id || '',
  };
}

/** Strip joined/read-only fields before roster:shift_update */
export function shiftUpdatePayload(form) {
  const {
    id, facility_id, location_id, role_id, shift_date, start_time, end_time,
    break_minutes, notes, status, is_open, pay_component_id, headcount,
  } = form;
  return {
    id,
    facility_id,
    location_id,
    role_id,
    shift_date,
    start_time,
    end_time,
    break_minutes: break_minutes ?? 0,
    notes: notes || null,
    status,
    is_open: is_open ? 1 : 0,
    pay_component_id,
    headcount: Math.max(1, parseInt(headcount, 10) || 1),
  };
}
