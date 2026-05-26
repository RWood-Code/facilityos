import React, { useMemo } from 'react';
import { XCircle, Clock, Wrench, Award } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { checkOverallCompliance } from '../../utils/compliance';
import { parseCustomLimits, isWaterTestPool } from '../../utils/poolUtils';

function qualStatus(expiry) {
  if (!expiry) return 'valid';
  try {
    const days = differenceInDays(parseISO(expiry), new Date());
    if (days < 0) return 'expired';
    if (days <= 30) return 'expiring';
    return 'valid';
  } catch { return 'valid'; }
}

export default function AlertsPanel({ pools, tests, workOrders, assets, qualifications, onNavigate, onSelectPool }) {
  const alerts = useMemo(() => {
    const list = [];
    (pools || []).filter((p) => isWaterTestPool(p.type)).forEach((pool) => {
      const latest = (tests || [])
        .filter((t) => t.pool_id === pool.id && t.test_type === 'routine')
        .sort((a, b) => ((b.test_date || '') + (b.test_time || '')).localeCompare((a.test_date || '') + (a.test_time || '')))[0];
      const compliant = latest
        ? checkOverallCompliance(latest, pool.type, parseCustomLimits(pool.custom_limits))
        : null;
      if (latest && compliant === false) {
        list.push({
          type: 'error', icon: XCircle, label: 'Non-Compliant Pool',
          detail: `${pool.name} — last test ${format(parseISO(latest.test_date), 'dd MMM')}`,
          action: () => { onSelectPool?.(pool.id); onNavigate?.('poolhistory'); },
        });
      }
    });
    (workOrders || []).forEach((wo) => {
      if (wo.due_date && !['completed', 'cancelled'].includes(wo.status)) {
        try {
          const overdue = differenceInDays(new Date(), parseISO(wo.due_date));
          if (overdue > 0) {
            list.push({
              type: 'error', icon: Clock, label: 'Overdue Work Order',
              detail: `${wo.title} — ${overdue}d overdue`,
              action: () => onNavigate?.('workorders'),
            });
          }
        } catch { /* ignore */ }
      }
    });
    (assets || []).filter((a) => a.status === 'down').forEach((a) => {
      list.push({
        type: 'error', icon: Wrench, label: 'Asset Down',
        detail: `${a.name}${a.location ? ` — ${a.location}` : ''}`,
        action: () => onNavigate?.('assets'),
      });
    });
    (qualifications || []).filter((q) => qualStatus(q.expiry_date) === 'expired').forEach((q) => {
      list.push({
        type: 'error', icon: Award, label: 'Expired Qualification',
        detail: q.qualification,
        action: () => onNavigate?.('staff'),
      });
    });
    (assets || []).filter((a) => a.status === 'needs_maintenance').forEach((a) => {
      list.push({
        type: 'warning', icon: Wrench, label: 'Needs Maintenance',
        detail: a.name,
        action: () => onNavigate?.('assets'),
      });
    });
    return list.slice(0, 12);
  }, [pools, tests, workOrders, assets, qualifications, onNavigate, onSelectPool]);

  if (!alerts.length) {
    return <p className="text-sm text-emerald-600 py-4 text-center">✓ No active alerts — all clear</p>;
  }

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const Icon = a.icon;
        return (
          <button
            key={i}
            type="button"
            onClick={a.action}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors hover:opacity-90 ${
              a.type === 'error' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
            }`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.type === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className="text-sm font-medium text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-600">{a.detail}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
