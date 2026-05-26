import React from 'react';
import { Calendar, Users, Clock, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui';

const ICONS = [Calendar, AlertCircle, CheckCircle2, Clock, DollarSign, Users];

export default function WeekSummaryBar({ summary }) {
  if (!summary) return null;
  const items = [
    { label: 'Shifts', value: summary.total_shifts, color: 'text-violet-700', bg: 'from-violet-50 to-white', border: 'border-violet-100' },
    { label: 'Open', value: summary.open_shifts, color: 'text-amber-700', bg: 'from-amber-50 to-white', border: 'border-amber-100' },
    { label: 'Published', value: `${summary.published_pct}%`, color: 'text-emerald-700', bg: 'from-emerald-50 to-white', border: 'border-emerald-100' },
    { label: 'Hours', value: summary.scheduled_hours?.toFixed(1), color: 'text-cyan-700', bg: 'from-cyan-50 to-white', border: 'border-cyan-100' },
    { label: 'Est. labour', value: `$${summary.labour_cost?.toFixed(0)}`, color: 'text-indigo-700', bg: 'from-indigo-50 to-white', border: 'border-indigo-100' },
    { label: 'Leave pending', value: summary.pending_leave, color: 'text-orange-700', bg: 'from-orange-50 to-white', border: 'border-orange-100' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {items.map((item, i) => {
        const Icon = ICONS[i];
        return (
          <Card key={item.label} className={`p-3 border bg-gradient-to-br ${item.bg} ${item.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${item.color} opacity-70`} />
              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">{item.label}</span>
            </div>
            <div className={`text-xl font-bold ${item.color}`}>{item.value ?? '—'}</div>
          </Card>
        );
      })}
    </div>
  );
}
