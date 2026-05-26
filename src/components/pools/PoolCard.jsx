import React from 'react';
import { format } from 'date-fns';
import { Droplets, Thermometer, Activity, Plus, ChevronRight } from 'lucide-react';
import { checkParam, checkOverallCompliance } from '../../utils/compliance';
import { parseCustomLimits } from '../../utils/poolUtils';
import { cn } from '../../lib/utils';
import { ComplianceBadge, Btn } from '../ui';

const PARAM_LABELS = {
  free_chlorine: { label: 'Cl₂', unit: 'mg/L' },
  ph: { label: 'pH', unit: '' },
  temperature: { label: 'Temp', unit: '°C' },
};

function paramColor(param, value, poolType, customLimits) {
  const result = checkParam(param, value, poolType, customLimits);
  if (result === false) return 'text-red-600';
  if (result === true) return 'text-emerald-700';
  return 'text-gray-700';
}

export default function PoolCard({ pool, latestTest, onAddTest, onViewHistory }) {
  const customLimits = parseCustomLimits(pool.custom_limits);
  const isCompliant = latestTest && latestTest.test_type === 'routine'
    ? checkOverallCompliance(latestTest, pool.type, customLimits)
    : undefined;

  return (
    <div className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white rounded-xl border border-gray-200/80 shadow-sm">
      <div
        className={cn(
          'h-1.5',
          isCompliant === true ? 'bg-emerald-500' : isCompliant === false ? 'bg-red-500' : 'bg-gray-300',
        )}
      />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{pool.name}</h3>
            <p className="text-sm text-gray-500 capitalize">{pool.type} · {pool.location || 'Main facility'}</p>
          </div>
          <ComplianceBadge compliant={isCompliant} />
        </div>

        {latestTest ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Last tested: {format(new Date(latestTest.test_date), 'MMM d, yyyy')}
              {latestTest.test_time ? ` at ${latestTest.test_time}` : ''}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-500" />
                <div>
                  <p className="text-xs text-gray-400">{PARAM_LABELS.free_chlorine.label}</p>
                  <p className={cn('text-sm font-medium', paramColor('free_chlorine', latestTest.free_chlorine, pool.type, customLimits))}>
                    {latestTest.free_chlorine ?? '—'} mg/L
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" />
                <div>
                  <p className="text-xs text-gray-400">{PARAM_LABELS.ph.label}</p>
                  <p className={cn('text-sm font-medium', paramColor('ph', latestTest.ph, pool.type, customLimits))}>
                    {latestTest.ph ?? '—'}
                  </p>
                </div>
              </div>
              {latestTest.temperature != null && (
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-gray-400">{PARAM_LABELS.temperature.label}</p>
                    <p className="text-sm font-medium text-gray-700">{latestTest.temperature}°C</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4">No tests recorded yet</p>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <Btn size="sm" className="flex-1" onClick={() => onAddTest(pool)}>
            <Plus className="w-4 h-4" />
            Add Test
          </Btn>
          {onViewHistory && (
            <Btn size="sm" variant="secondary" onClick={() => onViewHistory(pool)}>
              <ChevronRight className="w-4 h-4" />
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
