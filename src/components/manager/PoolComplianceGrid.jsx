import React from 'react';
import { ComplianceBadge } from '../ui';
import { checkOverallCompliance } from '../../utils/compliance';
import { parseCustomLimits, isWaterTestPool } from '../../utils/poolUtils';
import { format, parseISO } from 'date-fns';

export default function PoolComplianceGrid({ pools, tests, onNavigate, onSelectPool }) {
  const waterPools = (pools || []).filter((p) => isWaterTestPool(p.type));

  if (!waterPools.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">No pools configured</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {waterPools.map((pool) => {
        const latest = (tests || [])
          .filter((t) => t.pool_id === pool.id && t.test_type === 'routine')
          .sort((a, b) => ((b.test_date || '') + (b.test_time || '')).localeCompare((a.test_date || '') + (a.test_time || '')))[0];
        const compliant = latest
          ? checkOverallCompliance(latest, pool.type, parseCustomLimits(pool.custom_limits))
          : null;
        return (
          <button
            key={pool.id}
            type="button"
            onClick={() => { onSelectPool?.(pool.id); onNavigate?.('poolhistory'); }}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{pool.name}</p>
              <p className="text-xs text-gray-400">
                {latest ? `Tested ${format(parseISO(latest.test_date), 'd MMM')}` : 'No tests'}
              </p>
            </div>
            <ComplianceBadge compliant={compliant} />
          </button>
        );
      })}
    </div>
  );
}
