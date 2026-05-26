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
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card className="overflow-x-auto p-0 shadow-md border-violet-100">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="bg-gradient-to-r from-violet-700 via-violet-600 to-cyan-600 text-white">
            <th className="text-left p-3 w-36 sticky left-0 bg-violet-700 z-10 font-semibold">
              {view === 'location' ? 'Location' : 'Staff'}
            </th>
            {week.days.map((d) => {
              const isToday = d.date === todayStr;
              return (
                <th key={d.date} className={`p-2 text-center min-w-[110px] ${isToday ? 'bg-white/15' : ''}`}>
                  <div className="font-semibold">{d.label}</div>
                  <div className={`font-normal text-xs ${isToday ? 'text-cyan-200' : 'text-violet-200'}`}>
                    {d.date.slice(5)}{isToday ? ' · Today' : ''}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-8 text-center text-gray-400 text-sm">
                No {view === 'location' ? 'locations' : 'staff'} configured — add them in Settings or Staff
              </td>
            </tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-50 hover:bg-violet-50/30 transition-colors">
              <td className="p-2.5 font-medium sticky left-0 bg-white z-10 border-r border-gray-100 text-gray-900">
                {row.name || `${row.first_name} ${row.last_name}`}
              </td>
              {week.days.map((d) => {
                const dayShifts = shifts.filter((s) => s.shift_date === d.date && (
                  view === 'location' ? s.location_id === row.id : assignByShift[s.id]?.some((a) => a.staff_id === row.id)
                ));
                return (
                  <td key={d.date} className={`p-1.5 align-top min-h-[60px] ${d.date === todayStr ? 'bg-cyan-50/40' : ''}`}>
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
                        className="w-full h-8 rounded-lg border border-dashed border-violet-200 text-violet-300 hover:border-cyan-400 hover:text-cyan-500 hover:bg-cyan-50/50 text-lg transition-colors"
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
