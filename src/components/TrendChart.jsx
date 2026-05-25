import React from 'react';
import { getEffectiveLimits } from '../utils/compliance';
import { parseCustomLimits } from '../utils/poolUtils';

export default function TrendChart({ data, param, pool }) {
  const points = data
    .filter((t) => t[param] != null)
    .map((t) => ({
      x: `${t.test_date} ${t.test_time || ''}`.trim(),
      y: parseFloat(t[param]),
      compliant: t.is_compliant,
    }))
    .reverse()
    .slice(-60);

  if (!points.length) {
    return <div className="text-center py-8 text-gray-400">No data for this parameter</div>;
  }

  const customLimits = parseCustomLimits(pool?.custom_limits);
  const lim = pool ? getEffectiveLimits(pool.type, customLimits)[param] : null;

  const values = points.map((p) => p.y);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  const outOfRange = points.filter((p) => p.compliant === 0 || p.compliant === false).length;

  const svgW = 700;
  const svgH = 200;
  const padL = 45;
  const padR = 15;
  const padT = 15;
  const padB = 30;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const yMin = lim ? Math.min(minVal * 0.95, lim.min ?? minVal * 0.95) : minVal * 0.95;
  const yMax = lim ? Math.max(maxVal * 1.05, lim.max ?? maxVal * 1.05) : maxVal * 1.05;
  const yRange = yMax - yMin || 1;

  const toX = (i) => padL + (i / Math.max(points.length - 1, 1)) * chartW;
  const toY = (v) => padT + chartH - ((v - yMin) / yRange) * chartH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.y).toFixed(1)}`)
    .join(' ');

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm text-center">
        {[['Min', minVal], ['Max', maxVal], ['Average', avg], ['Out of Range', outOfRange]].map(([l, v]) => (
          <div key={l} className="flex-1 bg-gray-50 rounded-lg p-3">
            <div className="text-lg font-bold text-gray-900">{v}</div>
            <div className="text-xs text-gray-400">{l}</div>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full border border-gray-100 rounded-lg">
        {lim?.min != null && (
          <line x1={padL} y1={toY(lim.min)} x2={svgW - padR} y2={toY(lim.min)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" />
        )}
        {lim?.max != null && (
          <line x1={padL} y1={toY(lim.max)} x2={svgW - padR} y2={toY(lim.max)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" />
        )}
        <path d={linePath} fill="none" stroke="#0891b2" strokeWidth="2" />
        {points.map((p, i) => {
          const inRange = !lim || ((lim.min == null || p.y >= lim.min) && (lim.max == null || p.y <= lim.max));
          return <circle key={i} cx={toX(i)} cy={toY(p.y)} r="3" fill={inRange ? '#0891b2' : '#ef4444'} />;
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = yMin + f * yRange;
          return (
            <text key={f} x={padL - 4} y={padT + chartH - f * chartH + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
              {v.toFixed(1)}
            </text>
          );
        })}
        <text x={padL} y={svgH - 5} fontSize="9" fill="#9ca3af">{points[0]?.x.slice(5, 10)}</text>
        <text x={svgW - padR} y={svgH - 5} fontSize="9" fill="#9ca3af" textAnchor="end">{points[points.length - 1]?.x.slice(5, 10)}</text>
      </svg>
    </div>
  );
}
