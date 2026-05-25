import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Modal, Field, Input, Select, Textarea, Btn } from './ui';
import { checkParam, checkOverallCompliance, formatLimit, getScheduledTimes } from '../utils/compliance';
import { parseCustomLimits, isWaterTestPool } from '../utils/poolUtils';

const POOL_ORDER = ['Main Pool', 'Hydrotherapy Pool', 'Leisure Pool', 'Learners Pool', 'Spa Pool'];

const PARAMS = [
  { key: 'free_chlorine', label: 'Free Chlorine (FAC)', unit: 'mg/L', required: true },
  { key: 'total_available_chlorine', label: 'Total Available Chlorine (TAC)', unit: 'mg/L', required: true },
  { key: 'ph', label: 'pH', unit: '', required: true },
  { key: 'temperature', label: 'Temperature', unit: '°C', required: false },
  { key: 'total_alkalinity', label: 'Total Alkalinity', unit: 'mg/L', required: false },
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU', required: false },
];

export default function TestEntryModal({ open, onClose, pool, pools, onSaved }) {
  const { toast, currentStaff } = useAppStore();
  const waterPools = (pools || []).filter((p) => isWaterTestPool(p.type));
  const [selPoolId, setSelPoolId] = useState(pool?.id || '');
  const [pin, setPin] = useState('');
  const [staffName, setStaffName] = useState(currentStaff?.name || '');
  const [saving, setSaving] = useState(false);
  const pinRef = useRef(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = format(new Date(), 'HH:mm');
  const [form, setForm] = useState({ test_date: today, test_time: now, notes: '', action_taken: '' });
  const [vals, setVals] = useState({});

  const selPool = waterPools.find((p) => p.id === selPoolId) || pool;
  const customLimits = parseCustomLimits(selPool?.custom_limits);
  const scheduledTimes = selPool ? getScheduledTimes(selPool.type, form.test_date) : [];

  useEffect(() => {
    if (pool?.id) setSelPoolId(pool.id);
    if (currentStaff?.name) setStaffName(currentStaff.name);
  }, [pool, currentStaff]);

  useEffect(() => {
    if (open && waterPools.length === 1 && !selPoolId) setSelPoolId(waterPools[0].id);
  }, [open, waterPools, selPoolId]);

  async function lookupPin() {
    if (!pin || pin.length < 4) return;
    const staff = await dbQuery('staff:by_pin', pin).catch(() => null);
    if (staff) {
      setStaffName(`${staff.first_name} ${staff.last_name}`);
      toast(`Signed in: ${staff.first_name}`);
    } else {
      setStaffName('');
      toast('PIN not found', 'warn');
    }
  }

  const set = (k, v) => setVals((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selPoolId) {
      toast('Select a pool or spa', 'warn');
      return;
    }
    if (!vals.free_chlorine || !vals.ph) {
      toast('FAC and pH are required', 'warn');
      return;
    }
    setSaving(true);
    const tac = parseFloat(vals.total_available_chlorine);
    const fac = parseFloat(vals.free_chlorine);
    const combined_chlorine = !isNaN(tac) && !isNaN(fac) ? Math.max(0, parseFloat((tac - fac).toFixed(3))) : null;
    const data = {
      ...form,
      pool_id: selPoolId,
      tested_by: staffName || null,
      free_chlorine: parseFloat(vals.free_chlorine) || null,
      total_available_chlorine: parseFloat(vals.total_available_chlorine) || null,
      combined_chlorine,
      ph: parseFloat(vals.ph) || null,
      temperature: vals.temperature ? parseFloat(vals.temperature) : null,
      total_alkalinity: vals.total_alkalinity ? parseFloat(vals.total_alkalinity) : null,
      turbidity: vals.turbidity ? parseFloat(vals.turbidity) : null,
    };
    data.is_compliant = checkOverallCompliance(data, selPool?.type || 'pool', customLimits);
    try {
      await dbQuery('tests:create', data);
      toast('Test result saved');
      onSaved?.();
      onClose();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal title="Record Water Test" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {waterPools.length > 1 && (
            <Field label="Pool / spa" required className="col-span-2">
              <Select value={selPoolId} onChange={(e) => setSelPoolId(e.target.value)}>
                <option value="">Select…</option>
                {[...waterPools]
                  .sort((a, b) => POOL_ORDER.indexOf(a.name) - POOL_ORDER.indexOf(b.name))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === 'spa' ? 'Spa' : 'Pool'})
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field label="Test Date" required>
            <Input type="date" value={form.test_date} onChange={(e) => setForm((f) => ({ ...f, test_date: e.target.value }))} />
          </Field>
          <Field label="Test Time">
            <Select value={form.test_time} onChange={(e) => setForm((f) => ({ ...f, test_time: e.target.value }))}>
              {scheduledTimes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value={now}>Now ({now})</option>
            </Select>
          </Field>
        </div>

        {selPool?.custom_limits && (
          <p className="text-xs text-cyan-700 bg-cyan-50 px-3 py-2 rounded-lg mb-3">Custom NZS limits apply to this pool</p>
        )}

        <Field label="Staff PIN" className="mb-4">
          <div className="flex gap-2">
            <Input
              ref={pinRef}
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onBlur={lookupPin}
              placeholder="Enter PIN…"
              className="font-mono max-w-[140px]"
            />
            {staffName && <span className="flex items-center text-sm text-emerald-600">✓ {staffName}</span>}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-gray-50 rounded-xl">
          {PARAMS.map((p) => {
            const compliant = checkParam(p.key, vals[p.key], selPool?.type || 'pool', customLimits);
            const limit = formatLimit(p.key, selPool?.type || 'pool', customLimits);
            return (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">
                    {p.label}
                    {p.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {limit && <span className="text-xs text-gray-400">{limit}</span>}
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    step="0.01"
                    value={vals[p.key] || ''}
                    onChange={(e) => set(p.key, e.target.value)}
                    className={`flex-1 ${compliant === false ? 'border-red-400' : compliant === true ? 'border-emerald-400' : ''}`}
                  />
                  {p.unit && <span className="text-xs text-gray-400 w-12">{p.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <Field label="Action Taken">
          <Textarea rows={2} value={form.action_taken} onChange={(e) => setForm((f) => ({ ...f, action_taken: e.target.value }))} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>

        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Test Result'}</Btn>
        </div>
      </form>
    </Modal>
  );
}
