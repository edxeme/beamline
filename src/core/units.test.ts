import { describe, expect, it } from 'vitest';
import { forceFromKilonewtons, forceToKilonewtons, lengthFromMeters, lengthToMeters } from './units';

describe('unit conversions', () => {
  it('converts imperial forces to kilonewtons', () => {
    expect(forceToKilonewtons(1, 'kip')).toBeCloseTo(4.4482216152605, 9);
    expect(forceToKilonewtons(1000, 'lbf')).toBeCloseTo(4.4482216152605, 9);
  });

  it('round-trips forces without drift', () => {
    for (const unit of ['N', 'kN', 'lbf', 'kip'] as const) {
      const original = 12.345;
      const roundTrip = forceFromKilonewtons(forceToKilonewtons(original, unit), unit);
      expect(roundTrip).toBeCloseTo(original, 9);
    }
  });

  it('converts lengths to meters', () => {
    expect(lengthToMeters(1, 'ft')).toBeCloseTo(0.3048, 9);
    expect(lengthToMeters(25.4, 'mm')).toBeCloseTo(0.0254, 9);
  });

  it('round-trips lengths without drift', () => {
    for (const unit of ['mm', 'm', 'in', 'ft'] as const) {
      const original = 7.77;
      const roundTrip = lengthFromMeters(lengthToMeters(original, unit), unit);
      expect(roundTrip).toBeCloseTo(original, 9);
    }
  });
});
