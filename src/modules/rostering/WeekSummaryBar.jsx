import React from 'react';
import { Card } from '../../components/ui';

export default function WeekSummaryBar({ summary }) {
  if (!summary) return null;
  const items = [
    { label: 'Shifts', value: summary.total_shifts, color: 'text-slate-800' },
    { label: 'Open', value: summary.open_shifts, color: 'text-amber-700' },
    { label: 'Published', value: `${summary.published_pct}%`, color: 'text-emerald-700' },
    { label: 'Hours', value: summary.scheduled_hours?.toFixed(1), color: 'text-cyan-700' },
    { label: 'Est. labour', value: `$${summary.labour_cost?.toFixed(0)}`, color: 'text-violet-700' },
    { label: 'Leave pending', value: summary.pending_leave, color: 'text-orange-700' },
  ];

  return (
    <Card className="mb-4 p-0 overflow-hidden">
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-100">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-3 text-center">
            <div className={`text-lg font-bold ${item.color}`}>{item.value ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
