/**
 * Unit conversions between the units people actually draw with and the
 * SI units the solver works in. Factors are exact where the source
 * defines them (1 ft = 0.3048 m, 1 lbf = 4.4482216152605 N).
 */

export type ForceUnit = 'N' | 'kN' | 'lbf' | 'kip';
export type LengthUnit = 'mm' | 'm' | 'in' | 'ft';

const FORCE_TO_NEWTON: Record<ForceUnit, number> = {
  N: 1,
  kN: 1_000,
  lbf: 4.4482216152605,
  kip: 4_448.2216152605,
};

const LENGTH_TO_METER: Record<LengthUnit, number> = {
  mm: 0.001,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
};

export function forceToKilonewtons(value: number, unit: ForceUnit): number {
  return (value * FORCE_TO_NEWTON[unit]) / FORCE_TO_NEWTON.kN;
}

export function forceFromKilonewtons(value: number, unit: ForceUnit): number {
  return (value * FORCE_TO_NEWTON.kN) / FORCE_TO_NEWTON[unit];
}

export function lengthToMeters(value: number, unit: LengthUnit): number {
  return value * LENGTH_TO_METER[unit];
}

export function lengthFromMeters(value: number, unit: LengthUnit): number {
  return value / LENGTH_TO_METER[unit];
}
