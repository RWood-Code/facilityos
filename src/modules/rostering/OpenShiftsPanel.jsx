import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { Card, Btn, Select } from '../../components/ui';

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

export default function OpenShiftsPanel({ openShifts, staff, bulkStaff, setBulkStaff, onBulkFill, onAssign }) {
  return (
    <Card>
      <p className="text-sm text-gray-600 mb-3">Bulk assign or smart-match staff to open shifts.</p>
      <div className="flex gap-2 mb-4">
        <Select className="max-w-xs" value={bulkStaff} onChange={(e) => setBulkStaff(e.target.value)}>
          <option value="">Select staff…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </Select>
        <Btn onClick={onBulkFill} disabled={!bulkStaff}>Fill all open</Btn>
      </div>
      <div className="space-y-2">
        {openShifts.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-100">
            <div>
              <span className="font-medium">{s.shift_date}</span> {s.start_time}–{s.end_time}
              <span className="text-gray-500"> · {s.location_name} · {s.role_name}</span>
              {s.pay_code && <span className="ml-2 text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">{s.pay_code}</span>}
            </div>
            <MatchAssign shiftId={s.id} staff={staff} onAssign={onAssign} />
          </div>
        ))}
        {openShifts.length === 0 && <p className="text-gray-400 text-sm">No open shifts this week</p>}
      </div>
    </Card>
  );
}
