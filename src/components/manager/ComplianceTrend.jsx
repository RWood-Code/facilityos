import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { subDays, format, parseISO, startOfDay, isEqual } from 'date-fns';

export default function ComplianceTrend({ tests, days = 14 }) {
  const data = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const date = startOfDay(subDays(new Date(), days - 1 - i));
      const dayTests = (tests || []).filter((t) => {
        try { return isEqual(startOfDay(parseISO(t.test_date)), date); } catch { return false; }
      });
      const compliant = dayTests.filter((t) => t.is_compliant === 1 || t.is_compliant === true).length;
      const total = dayTests.length;
      return {
        date: format(date, 'dd MMM'),
        total,
        compliant,
        rate: total > 0 ? Math.round((compliant / total) * 100) : null,
      };
    });
  }, [tests, days]);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} interval={Math.floor(days / 7)} />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} domain={[0, 100]} unit="%" />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
                <p className="font-semibold text-gray-700 mb-1">{label}</p>
                <p className="text-gray-500">{d.compliant}/{d.total} compliant</p>
                {d.rate !== null && <p className="text-cyan-600 font-medium">{d.rate}% rate</p>}
              </div>
            );
          }}
        />
        <Line type="monotone" dataKey="rate" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
