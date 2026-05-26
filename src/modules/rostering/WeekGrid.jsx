import React from 'react';
import { Card } from '../../components/ui';
import ShiftCard from './ShiftCard';

export default function WeekGrid({
  week,
  view,
  locations,
  staff,
  shifts,
  assignByShift,
  onShiftClick,
  onNewShift,
  onAssign,
}) {
  const rows = view === 'location' ? locations : staff;

  return (
    <Card className="overflow-x-auto p-0">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
              <th className="text-left p-2 w-32 sticky left-0 bg-slate-800 z-10">
                {view === 'location' ? 'Location' : 'Staff'}
              </th>
              {week.days.map((d) => (
                <th key={d.date} className="p-2 text-center min-w-[110px]">
                  <div className="font-semibold">{d.label}</div>
                  <div className="text-slate-300 font-normal">{d.date.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="p-2 font-medium sticky left-0 bg-white z-10 border-r border-gray-100">
                  {row.name || `${row.first_name} ${row.last_name}`}
                </td>
                {week.days.map((d) => {
                  const dayShifts = shifts.filter((s) => s.shift_date === d.date && (
                    view === 'location' ? s.location_id === row.id : assignByShift[s.id]?.some((a) => a.staff_id === row.id)
                  ));
                  return (
                    <td key={d.date} className="p-1 align-top min-h-[60px]">
                      {dayShifts.map((s) => {
                        const asg = assignByShift[s.id] || [];
                        const assignees = asg.map((a) => {
                          const st = staff.find((x) => x.id === a.staff_id);
                          return st ? { ...a, first_name: st.first_name, last_name: st.last_name } : a;
                        });
                        return (
                          <ShiftCard
                            key={s.id}
                            shift={s}
                            assignees={assignees}
                            payCode={s.pay_code || asg[0]?.pay_code}
                            staff={staff}
                            onClick={() => onShiftClick(s)}
                            onAssign={onAssign}
                            showLocation={view === 'staff'}
                          />
                        );
                      })}
                      {dayShifts.length === 0 && view === 'location' && (
                        <button
                          type="button"
                          onClick={() => onNewShift(d.date, row.id)}
                          className="w-full h-8 rounded border border-dashed border-gray-200 text-gray-300 hover:border-cyan-400 hover:text-cyan-500 text-lg"
                          title="Add shift"
                        >
                          +
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
  );
}
