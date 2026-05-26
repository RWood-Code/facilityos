import React from 'react';
import { Card, Btn } from '../../components/ui';

export default function SwapsPanel({ offers, onRespond }) {
  return (
    <Card>
      <p className="text-sm text-gray-600 mb-4">Pending shift swap offers between staff.</p>
      {offers.length === 0 ? (
        <p className="text-gray-400 text-sm">No pending shift offers</p>
      ) : (
        offers.map((o) => (
          <div key={o.id} className="flex justify-between items-center py-3 border-b border-gray-50">
            <div>
              <span className="font-medium">{o.shift_date}</span> {o.start_time}–{o.end_time}
              <span className="text-gray-500"> — {o.from_first} {o.from_last} → {o.to_first} {o.to_last}</span>
            </div>
            <div className="flex gap-2">
              <Btn size="sm" onClick={() => onRespond(o.id, true)}>Accept</Btn>
              <Btn size="sm" variant="secondary" onClick={() => onRespond(o.id, false)}>Decline</Btn>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
