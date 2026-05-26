import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { Card, Btn, StatusBadge, Input } from '../../components/ui';

export default function TimesheetsPanel({ week, currentStaff }) {
  const { toast } = useAppStore();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    dbQuery('roster:timesheets', { week_start: week.week_start, week_end: week.week_end })
      .then(setEntries)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [week.week_start]);

  async function generate() {
    const r = await dbQuery('roster:generate_timesheets', { week_start: week.week_start, week_end: week.week_end });
    toast(`Generated ${r.created} timesheet entries`);
    load();
  }

  async function approve(id, hours) {
    await dbQuery('roster:timesheet_approve', { id, approved_by: currentStaff?.name, hours });
    toast('Timesheet approved');
    load();
  }

  async function updateHours(id, hours) {
    await dbQuery('roster:timesheet_update', { id, hours: parseFloat(hours) });
    load();
  }

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <p className="text-sm text-gray-600">Rostered hours from published shifts — approve before payroll export.</p>
        <Btn size="sm" variant="secondary" onClick={generate}>Generate from roster</Btn>
      </div>
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 text-sm">No timesheet entries — publish the week or click Generate from roster.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="text-left py-2">Staff</th>
              <th>Date</th>
              <th>Pay code</th>
              <th className="text-right">Hours</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-50">
                <td className="py-2">{e.first_name} {e.last_name}</td>
                <td>{e.work_date}</td>
                <td className="font-mono text-xs">{e.pay_code || '—'}</td>
                <td className="text-right">
                  {e.status === 'draft' ? (
                    <Input
                      type="number"
                      step="0.25"
                      className="w-20 text-right ml-auto"
                      defaultValue={e.hours}
                      onBlur={(ev) => updateHours(e.id, ev.target.value)}
                    />
                  ) : (
                    <span className="font-mono">{e.hours}</span>
                  )}
                </td>
                <td><StatusBadge status={e.status === 'approved' ? 'completed' : 'open'} /></td>
                <td className="text-right">
                  {e.status === 'draft' && (
                    <Btn size="sm" onClick={() => approve(e.id, e.hours)}>Approve</Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
