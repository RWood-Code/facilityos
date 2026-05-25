import React from 'react';
import { Field, Input } from './ui';
import { formatLimit, NZS5826_LIMITS } from '../utils/compliance';
import { LIMIT_PARAM_KEYS } from '../utils/poolUtils';

export default function CustomLimitsEditor({ poolType, limitForm, setLimitForm }) {
  const set = (k, v) => setLimitForm((f) => ({ ...f, [k]: v }));
  const defaults = NZS5826_LIMITS[poolType] || NZS5826_LIMITS.pool;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/80 mt-4">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
        <input
          type="checkbox"
          checked={!!limitForm.useCustom}
          onChange={(e) => set('useCustom', e.target.checked)}
          className="rounded"
        />
        Override NZS 5826 limits for this pool
      </label>
      {!limitForm.useCustom ? (
        <p className="text-xs text-gray-500">
          Using standard {poolType === 'spa' ? 'spa' : 'pool'} defaults from NZS 5826:2010.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">Leave blank to keep the default for that bound.</p>
          {LIMIT_PARAM_KEYS.filter(({ key }) => defaults[key]).map(({ key, label, unit }) => (
            <div key={key} className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-1">
                <span className="text-xs font-medium text-gray-700">{label}</span>
                <div className="text-[10px] text-gray-400">Default: {formatLimit(key, poolType, {})}</div>
              </div>
              <Field label="Min">
                <Input
                  type="number"
                  step="0.01"
                  value={limitForm[`${key}_min`] ?? ''}
                  onChange={(e) => set(`${key}_min`, e.target.value)}
                  placeholder="—"
                />
              </Field>
              <Field label={`Max${unit ? ` (${unit})` : ''}`}>
                <Input
                  type="number"
                  step="0.01"
                  value={limitForm[`${key}_max`] ?? ''}
                  onChange={(e) => set(`${key}_max`, e.target.value)}
                  placeholder="—"
                />
              </Field>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
