import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { dbQuery } from '../../hooks/useDb';
import { PageHeader, Card, Field, Input, Btn } from '../../components/ui';

export default function Profile() {
  const { currentStaff, setCurrentStaff, toast } = useAppStore();
  const [pin, setPin] = useState('');

  async function signIn() {
    const staff = await dbQuery('staff:by_pin', pin).catch(() => null);
    if (staff) {
      setCurrentStaff({ id: staff.id, name: `${staff.first_name} ${staff.last_name}`, role: staff.role, ...staff });
      toast(`Signed in as ${staff.first_name}`);
    } else toast('PIN not found', 'warn');
  }

  function signOut() {
    setCurrentStaff(null);
    setPin('');
    toast('Signed out');
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Staff PIN session for sign-off across modules" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        <Card>
          <h3 className="font-semibold mb-3">Current session</h3>
          {currentStaff ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-lg font-bold">
                  {currentStaff.name?.[0]}
                </div>
                <div>
                  <div className="font-semibold">{currentStaff.name}</div>
                  <div className="text-sm text-gray-500 capitalize">{currentStaff.role?.replace('_', ' ')}</div>
                </div>
              </div>
              <Btn variant="secondary" onClick={signOut}>Sign out</Btn>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not signed in — enter PIN below</p>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">PIN login</h3>
          <Field label="Staff PIN"><Input type="password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" /></Field>
          <Btn onClick={signIn} className="w-full">Sign in</Btn>
          <p className="text-xs text-gray-400 mt-3">Demo PINs: 1234 (Sarah), 2345 (Mike), 3456 (Emma)</p>
        </Card>
      </div>
    </div>
  );
}
