/**
 * NZS 5826 Appendix E style dosing guidance (indicative — verify against your plant spec).
 */

export const CHEMICALS = [
  { id: 'liquid_chlorine', name: 'Liquid chlorine (12.5% NaOCl)', unit: 'mL', per10klPerPpm: 100 },
  { id: 'calcium_hypo', name: 'Calcium hypochlorite (65%)', unit: 'g', per10klPerPpm: 15 },
  { id: 'acid_muriatic', name: 'Muriatic acid (31%) — lowers pH', unit: 'mL', per10klPer0p1ph: 110 },
  { id: 'soda_ash', name: 'Soda ash — raises pH', unit: 'g', per10klPer0p1ph: 14 },
  { id: 'bicarb', name: 'Sodium bicarbonate — raises TA', unit: 'g', per10klPer10ppm: 150 },
];

export function calcChlorineDose({ volumeLitres, currentPpm, targetPpm, chemicalId }) {
  const chem = CHEMICALS.find((c) => c.id === chemicalId) || CHEMICALS[0];
  const delta = Math.max(0, (targetPpm || 0) - (currentPpm || 0));
  const volumeKl = (volumeLitres || 0) / 1000;
  const amount = (volumeKl / 10) * delta * chem.per10klPerPpm;
  return {
    chemical: chem.name,
    amount: Math.round(amount * 10) / 10,
    unit: chem.unit,
    deltaPpm: delta,
    note: delta === 0 ? 'Already at or above target' : 'Add slowly with circulation running; retest after 30 minutes',
  };
}

export function calcPhDose({ volumeLitres, currentPh, targetPh, direction }) {
  const vol = volumeLitres || 0;
  const delta = Math.abs((targetPh || 7.4) - (currentPh || 7.4));
  const steps = Math.round(delta / 0.1);
  if (direction === 'lower' || (currentPh || 0) > (targetPh || 0)) {
    const ml = (vol / 10000) * steps * 110;
    return { chemical: 'Muriatic acid (31%)', amount: Math.round(ml), unit: 'mL', direction: 'lower', steps };
  }
  const g = (vol / 10000) * steps * 14;
  return { chemical: 'Soda ash', amount: Math.round(g), unit: 'g', direction: 'raise', steps };
}

export function calcTaDose({ volumeLitres, currentTa, targetTa }) {
  const delta = Math.max(0, (targetTa || 0) - (currentTa || 0));
  const g = ((volumeLitres || 0) / 10000) * (delta / 10) * 150;
  return { chemical: 'Sodium bicarbonate', amount: Math.round(g), unit: 'g', deltaTa: delta };
}
