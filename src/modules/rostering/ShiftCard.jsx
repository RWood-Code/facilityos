import React from 'react';

import { Select } from '../../components/ui';



function assigneeLabel(assignees, showLocation, shift) {

  if (showLocation) return shift.location_name;

  if (!assignees?.length) return 'Open shift';

  if (assignees.length === 1) return assignees[0].first_name;

  return `${assignees[0].first_name} +${assignees.length - 1}`;

}



export default function ShiftCard({

  shift,

  assignees = [],

  payCode,

  staff,

  onClick,

  onAssign,

  showLocation,

  compact,

}) {

  const isDraft = shift.status === 'draft';

  const headcount = Math.max(1, shift.headcount || 1);

  const isOpen = shift.is_open === 1 || assignees.length < headcount;

  const color = shift.role_color || '#0891b2';

  const assignedIds = new Set(assignees.map((a) => a.staff_id));

  const availableStaff = staff?.filter((s) => !assignedIds.has(s.id)) || [];



  function handleAssign(staffId) {

    if (!staffId || !onAssign) return;

    const replace = headcount === 1 && assignees.length > 0;

    onAssign(shift.id, staffId, { replace });

  }



  return (

    <div

      className={`group w-full text-left mb-1 rounded-lg border transition-all hover:shadow-md ${

        isDraft ? 'border-dashed' : 'border-solid'

      } ${isOpen ? 'bg-amber-50/80' : 'bg-white'}`}

      style={{

        borderLeftColor: color,

        borderLeftWidth: 4,

        boxShadow: `inset 0 0 0 1px ${color}15`,

      }}

    >

      <button type="button" onClick={onClick} className="w-full text-left p-1.5 pb-0">

        <div className="flex items-center justify-between gap-1">

          <span className="font-semibold text-[11px] text-gray-900">{shift.start_time}–{shift.end_time}</span>

          {payCode && (

            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 text-slate-600">{payCode}</span>

          )}

        </div>

        <div className="text-[10px] text-gray-600 truncate mt-0.5">

          {assigneeLabel(assignees, showLocation, shift)}

        </div>

        {!compact && assignees.length > 1 && (

          <div className="text-[9px] text-gray-500 truncate">

            {assignees.map((a) => a.first_name).join(', ')}

          </div>

        )}

        {!compact && shift.role_name && (

          <div className="text-[9px] text-gray-400 truncate">{shift.role_name}</div>

        )}

        <div className="flex items-center gap-1 mt-1 flex-wrap">

          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${

            shift.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'

          }`}>

            {shift.status}

          </span>

          {headcount > 1 && (

            <span className="text-[9px] text-slate-600">{assignees.length}/{headcount}</span>

          )}

          {isOpen && <span className="text-[9px] text-amber-700 font-medium">Needs fill</span>}

        </div>

      </button>

      {onAssign && availableStaff.length > 0 && assignees.length < headcount && (

        <div className="px-1.5 pb-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">

          <Select

            className="text-[10px] w-full py-0.5"

            value=""

            onChange={(e) => handleAssign(e.target.value)}

          >

            <option value="">

              {assignees.length === 0 ? 'Assign…' : headcount === 1 ? 'Reassign…' : 'Add staff…'}

            </option>

            {availableStaff.map((s) => (

              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>

            ))}

          </Select>

        </div>

      )}

    </div>

  );

}


