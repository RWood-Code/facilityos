import React, { useState } from 'react';
import { dbQuery } from '../hooks/useDb';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Input } from './ui';
import { isElectron, apiUrl, buildAuthHeaders, getTerminalId, setSessionToken } from '../utils/mobileAccess';

/**
 * Staff PIN sign-in — full gate on desktop (Electron), optional overlay on mobile/PWA.
 */
export default function StaffSignIn({ variant = 'overlay', onDone }) {
  const { setCurrentStaff, toast } = useAppStore();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const isGate = variant === 'gate';

  async function signInWithSession(pinValue) {
    const res = await fetch(apiUrl('/api/auth/pin'), {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ pin: pinValue, terminalId: getTerminalId() }),
    });
    const result = await res.json();
    if (!result.ok) return null;
    setSessionToken(result.data.token);
    return result.data.staff;
  }

  function applyStaff(staff) {
    setCurrentStaff({
      id: staff.id,
      name: staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
      role: staff.role,
    });
    sessionStorage.setItem('facilityos_staff_id', staff.id);
    onDone?.();
  }

  async function signIn(e) {
    e?.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    try {
      const sessionStaff = await signInWithSession(pin.trim());
      if (sessionStaff) {
        applyStaff(sessionStaff);
        return;
      }

      const staff = await dbQuery('staff:by_pin', pin.trim());
      if (!staff) {
        toast('Invalid PIN', 'warn');
        return;
      }
      applyStaff(staff);
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={signIn} className={isGate ? 'w-full max-w-sm' : 'bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 safe-area-bottom'}>
      {isGate && (
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-gray-900 tracking-tight">FacilityOS</div>
          <p className="text-sm text-gray-500 mt-2">Enter your staff PIN to open the application</p>
        </div>
      )}
      {!isGate && (
        <>
          <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">Enter your staff PIN to record tests and checks.</p>
        </>
      )}
      <Field label="Staff PIN">
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="text-lg tracking-widest min-h-[48px] text-center"
        />
      </Field>
      <Btn type="submit" className="w-full mt-4 min-h-[48px]" disabled={busy || !pin.trim()}>
        {busy ? 'Checking…' : isGate ? 'Unlock' : 'Continue'}
      </Btn>
      {isGate && isElectron() && (
        <p className="text-xs text-gray-400 text-center mt-4">Default admin: PIN 9663 (Wood Master)</p>
      )}
    </form>
  );

  if (isGate) {
    return (
      <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-100 to-cyan-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-md">
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      {form}
    </div>
  );
}
