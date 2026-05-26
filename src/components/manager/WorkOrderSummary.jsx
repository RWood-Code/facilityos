import React from 'react';
import { PriorityBadge, StatusBadge } from '../ui';
import { format, parseISO } from 'date-fns';

export default function WorkOrderSummary({ workOrders, onNavigate }) {
  const open = (workOrders || []).filter((wo) => !['completed', 'cancelled'].includes(wo.status));
  const recent = open.slice(0, 6);

  if (!recent.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">No open work orders</p>;
  }

  return (
    <div className="space-y-2">
      {recent.map((wo) => (
        <button
          key={wo.id}
          type="button"
          onClick={() => onNavigate?.('workorders')}
          className="w-full text-left p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 line-clamp-1">{wo.title}</p>
            <PriorityBadge priority={wo.priority} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={wo.status} />
            {wo.due_date && (
              <span className="text-xs text-gray-400">Due {format(parseISO(wo.due_date), 'd MMM')}</span>
            )}
          </div>
        </button>
      ))}
      {open.length > 6 && (
        <p className="text-xs text-center text-gray-400 pt-1">+{open.length - 6} more open</p>
      )}
    </div>
  );
}
