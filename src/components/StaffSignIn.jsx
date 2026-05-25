import React, { useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Input } from './ui';
import { isElectron } from '../utils/mobileAccess';

export default function StaffSignIn({ onDone }) {
  const { setCurrentStaff, toast } = useAppStore();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  if (isElectron) return null;

  async function signIn(e) {
    e?.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    try {
      const staff = await dbQuery('staff:by_pin', pin.trim());
      if (!staff) {
        toast('Invalid PIN', 'warn');
        return;
      }
      setCurrentStaff({
        id: staff.id,
        name: `${staff.first_name} ${staff.last_name}`.trim(),
        role: staff.role,
      });
      sessionStorage.setItem('facilityos_staff_id', staff.id);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <form
        onSubmit={signIn}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 safe-area-bottom"
      >
        <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Enter your staff PIN to record tests and checks.</p>
        <Field label="Staff PIN">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="text-lg tracking-widest min-h-[48px]"
          />
        </Field>
        <Btn type="submit" className="w-full mt-4 min-h-[48px]" disabled={busy || !pin.trim()}>
          {busy ? 'Checking…' : 'Continue'}
        </Btn>
      </form>
    </div>
  );
}
