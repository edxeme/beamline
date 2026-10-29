import { describe, expect, it } from 'vitest';
import { analyzeBeam, BeamError } from './beam';
import type { BeamInput, BeamResult, Sample } from './types';

const simplySupported = (loads: BeamInput['loads'], length = 6): BeamInput => ({
  length,
  supports: [
    { kind: 'pin', position: 0 },
    { kind: 'roller', position: length },
  ],
  loads,
});

// Strict-mode friendly accessors: indexes are known to exist in these tests.
const reactionAt = (result: BeamResult, index: number) => result.reactions[index]!;
const lastSample = (result: BeamResult): Sample => result.samples[result.samples.length - 1]!;

describe('analyzeBeam', () => {
  it('solves a central point load symmetrically', () => {
    const result = analyzeBeam(simplySupported([{ kind: 'point', magnitude: 10, position: 3 }]));

    expect(reactionAt(result, 0).force).toBeCloseTo(5, 9);
    expect(reactionAt(result, 1).force).toBeCloseTo(5, 9);
    expect(result.maxSagging?.moment).toBeCloseTo(15, 0);
  });

  it('matches the wL²/8 textbook value for a full uniform load', () => {
    const result = analyzeBeam(
      simplySupported([{ kind: 'udl', magnitude: 2, start: 0, end: 6 }]),
    );

    expect(reactionAt(result, 0).force).toBeCloseTo(6, 9);
    expect(reactionAt(result, 1).force).toBeCloseTo(6, 9);
    expect(result.maxSagging?.moment).toBeCloseTo(9, 1);
    expect(result.maxSagging?.position).toBeCloseTo(3, 1);
    expect(result.maxHogging).toBeNull();
  });

  it('places the peak moment under an off-center point load', () => {
    // P=12 kN at 2 m on a 6 m span: R1=8, R2=4, Mmax = 8*2 = 16 kN·m at 2 m.
    const result = analyzeBeam(simplySupported([{ kind: 'point', magnitude: 12, position: 2 }]));

    expect(reactionAt(result, 0).force).toBeCloseTo(8, 9);
    expect(reactionAt(result, 1).force).toBeCloseTo(4, 9);
    expect(result.maxSagging?.position).toBeCloseTo(2, 2);
    expect(result.maxSagging?.moment).toBeCloseTo(16, 1);
  });

  it('returns zero moment at both supports of a simply supported beam', () => {
    const result = analyzeBeam(
      simplySupported([
        { kind: 'point', magnitude: 5, position: 1.5 },
        { kind: 'udl', magnitude: 1.5, start: 2, end: 5 },
      ]),
    );

    expect(result.samples[0]!.moment).toBeCloseTo(0, 9);
    expect(lastSample(result).moment).toBeCloseTo(0, 9);
  });

  it('solves a cantilever with an end point load', () => {
    // P=5 kN at the free end of a 4 m cantilever fixed at x=0.
    const result = analyzeBeam({
      length: 4,
      supports: [{ kind: 'fixed', position: 0 }],
      loads: [{ kind: 'point', magnitude: 5, position: 4 }],
    });

    expect(reactionAt(result, 0).force).toBeCloseTo(5, 9);
    expect(reactionAt(result, 0).moment).toBeCloseTo(20, 6);
    expect(result.maxHogging?.moment).toBeCloseTo(20, 6);
    expect(lastSample(result).moment).toBeCloseTo(0, 6);
    expect(lastSample(result).shear).toBeCloseTo(0, 6);
  });

  it('solves a cantilever fixed at the right end by mirroring', () => {
    const leftFixed = analyzeBeam({
      length: 4,
      supports: [{ kind: 'fixed', position: 0 }],
      loads: [{ kind: 'point', magnitude: 5, position: 1 }],
    });
    const rightFixed = analyzeBeam({
      length: 4,
      supports: [{ kind: 'fixed', position: 4 }],
      loads: [{ kind: 'point', magnitude: 5, position: 3 }],
    });

    const leftMax = leftFixed.maxHogging!.moment;
    const rightMax = rightFixed.maxHogging!.moment;
    expect(rightMax).toBeCloseTo(leftMax, 6);
    expect(reactionAt(rightFixed, 0).force).toBeCloseTo(5, 9);
  });

  it('rejects an unstable single pin support', () => {
    expect(() =>
      analyzeBeam({ length: 6, supports: [{ kind: 'pin', position: 0 }], loads: [] }),
    ).toThrow(BeamError);
  });

  it('rejects loads outside the span', () => {
    expect(() =>
      analyzeBeam(simplySupported([{ kind: 'point', magnitude: 1, position: 9 }])),
    ).toThrowError(/outside the span/);
  });

  it('rejects a non-positive length', () => {
    expect(() => analyzeBeam({ length: 0, supports: [], loads: [] })).toThrowError(/positive/);
  });
});
