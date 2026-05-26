import React from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';

function status(expiry) {
  if (!expiry) return 'valid';
  try {
    const d = differenceInDays(parseISO(expiry), new Date());
    if (d < 0) return 'expired';
    if (d <= 30) return 'expiring';
    return 'valid';
  } catch { return 'valid'; }
}

export default function QualificationAlerts({ qualifications, staff, onNavigate }) {
  const staffMap = Object.fromEntries((staff || []).map((s) => [s.id, s]));
  const alerts = (qualifications || [])
    .map((q) => ({ ...q, st: status(q.expiry_date) }))
    .filter((q) => q.st !== 'valid')
    .sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''))
    .slice(0, 8);

  if (!alerts.length) {
    return <p className="text-sm text-emerald-600 py-4 text-center">✓ All qualifications current</p>;
  }

  return (
    <div className="space-y-2">
      {alerts.map((q) => {
        const person = staffMap[q.staff_id];
        const name = person ? `${person.first_name} ${person.last_name}` : 'Staff member';
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onNavigate?.('staff')}
            className={`w-full text-left p-3 rounded-lg border transition-colors hover:opacity-90 ${
              q.st === 'expired' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">{q.qualification}</p>
            <p className="text-xs text-gray-600">{name}</p>
            {q.expiry_date && (
              <p className={`text-xs mt-0.5 ${q.st === 'expired' ? 'text-red-600' : 'text-amber-700'}`}>
                {q.st === 'expired' ? 'Expired' : 'Expires'} {format(parseISO(q.expiry_date), 'd MMM yyyy')}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
