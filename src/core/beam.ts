import type { BeamInput, BeamResult, Load, Reaction, Sample, Support } from './types';

/** Raised when a beam definition is invalid or unstable. */
export class BeamError extends Error {
  /** Stable machine-readable identifier, e.g. `beam/unsupported-layout`. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BeamError';
    this.code = code;
  }
}

/** Sampling resolution along the span. */
const SAMPLE_INTERVALS = 400;

/** Values below this magnitude are treated as zero when locating peaks. */
const EPSILON = 1e-9;

/**
 * Sign convention: loads are positive downward, reactions positive upward,
 * shear is the net upward force to the left of a section, and bending moment
 * is positive when sagging.
 */
export function analyzeBeam(input: BeamInput): BeamResult {
  const { length, supports, loads } = input;
  validateInput(length, supports, loads);

  const isCantilever = supports.length === 1;
  const fixed = supports.find((support) => support.kind === 'fixed');
  // A cantilever fixed at the right end is solved as its mirror image so that
  // the left-to-right sweep below only has to handle one orientation.
  const mirrored = isCantilever && fixed?.position === length;
  const normLoads = mirrored ? loads.map((load) => mirrorLoad(load, length)) : loads;

  const solved = isCantilever
    ? solveCantilever(length, normLoads)
    : solveSimple(supports, normLoads);

  const reactions: Reaction[] = supports.map((support) => {
    // The cantilever is always solved with its fixed end at x = 0, even when
    // the original input fixes the right end; the reported position stays original.
    const key = isCantilever ? 0 : support.position;
    const force = solved.reactions.get(key);
    if (force === undefined) {
      throw new BeamError('beam/internal', 'Solver did not produce a reaction for a support.');
    }
    const reaction: Reaction = { position: support.position, force };
    if (support.kind === 'fixed') {
      reaction.moment = solved.fixedMoment;
    }
    return reaction;
  });

  let samples = sampleBeam(length, normLoads, solved);
  if (mirrored) {
    samples = samples
      .map((s) => ({ position: length - s.position, shear: -s.shear, moment: s.moment }))
      .reverse();
  }

  return { reactions, samples, ...extremes(samples) };
}

function validateInput(length: number, supports: Support[], loads: Load[]): void {
  if (!isFinite(length) || length <= 0) {
    throw new BeamError('beam/invalid-length', 'Beam length must be a positive, finite number.');
  }

  if (supports.length === 1) {
    const only = expectSupport(supports, 0);
    if (only.kind !== 'fixed') {
      throw new BeamError(
        'beam/unsupported-layout',
        'A single support must be `fixed`. A lone pin or roller cannot stabilize a beam.',
      );
    }
    if (only.position !== 0 && only.position !== length) {
      throw new BeamError('beam/unsupported-layout', 'A cantilever must be fixed at one end of the span.');
    }
  } else if (supports.length === 2) {
    if (supports.some((s) => s.kind === 'fixed')) {
      throw new BeamError(
        'beam/unsupported-layout',
        'A fixed support combined with another support is statically indeterminate and is not supported.',
      );
    }
    const first = expectSupport(supports, 0);
    const second = expectSupport(supports, 1);
    if (first.position === second.position) {
      throw new BeamError('beam/unsupported-layout', 'Supports must sit at distinct positions.');
    }
  } else {
    throw new BeamError('beam/unsupported-layout', 'Provide two pin/roller supports, or one fixed support.');
  }

  for (const support of supports) {
    if (!isFinite(support.position) || support.position < 0 || support.position > length) {
      throw new BeamError('beam/invalid-support', `Support at ${support.position} m is outside the span.`);
    }
  }

  for (const load of loads) {
    if (!isFinite(load.magnitude)) {
      throw new BeamError('load/invalid-magnitude', 'Load magnitudes must be finite numbers.');
    }
    if (load.kind === 'point') {
      if (!isFinite(load.position) || load.position < 0 || load.position > length) {
        throw new BeamError('load/out-of-span', `Point load at ${load.position} m is outside the span.`);
      }
    } else if (
      !isFinite(load.start) ||
      !isFinite(load.end) ||
      load.start < 0 ||
      load.end > length ||
      load.start >= load.end
    ) {
      throw new BeamError('load/invalid-segment', `Uniform load [${load.start}, ${load.end}] m is not a valid segment.`);
    }
  }
}

/** Indexed access with `noUncheckedIndexedAccess` would otherwise return `T | undefined`. */
function expectSupport(supports: Support[], index: number): Support {
  const support = supports[index];
  if (!support) {
    throw new BeamError('beam/unsupported-layout', 'Provide two pin/roller supports, or one fixed support.');
  }
  return support;
}

function mirrorLoad(load: Load, length: number): Load {
  if (load.kind === 'point') {
    return { ...load, position: length - load.position };
  }
  return { ...load, start: length - load.end, end: length - load.start };
}

/** Resultant force and its line of action for any load. */
function resultant(load: Load): { force: number; position: number } {
  if (load.kind === 'point') {
    return { force: load.magnitude, position: load.position };
  }
  return {
    force: load.magnitude * (load.end - load.start),
    position: (load.start + load.end) / 2,
  };
}

interface Solved {
  /** Support reactions keyed by the position they act at. */
  reactions: Map<number, number>;
  /** Reaction moment at the fixed support, hogging-positive. Cantilevers only. */
  fixedMoment?: number;
  /** Constant bending-moment offset applied to the right of the fixed support. */
  couple: number;
}

function solveSimple(supports: Support[], loads: Load[]): Solved {
  const sorted = [...supports].sort((a, b) => a.position - b.position);
  const first = expectSupport(sorted, 0);
  const second = expectSupport(sorted, 1);

  const span = second.position - first.position;
  const total = loads.reduce((sum, load) => sum + resultant(load).force, 0);
  const momentAboutFirst = loads.reduce((sum, load) => {
    const r = resultant(load);
    return sum + r.force * (r.position - first.position);
  }, 0);

  const rightReaction = momentAboutFirst / span;
  const leftReaction = total - rightReaction;

  return {
    reactions: new Map([
      [first.position, leftReaction],
      [second.position, rightReaction],
    ]),
    couple: 0,
  };
}

function solveCantilever(length: number, loads: Load[]): Solved {
  // Fixed at x = 0, free end at x = L. Equilibrium gives R = ΣP, and the
  // free-end condition M(L) = 0 fixes the constant C in M(x) = R·x + C − ΣP·(x−xi).
  const total = loads.reduce((sum, load) => sum + resultant(load).force, 0);
  const momentAboutFreeEnd = loads.reduce((sum, load) => {
    const r = resultant(load);
    return sum + r.force * (length - r.position);
  }, 0);
  const couple = momentAboutFreeEnd - total * length;

  return {
    reactions: new Map([[0, total]]),
    fixedMoment: -couple,
    couple,
  };
}

/** Sample shear and bending moment along the span using a left-to-right sweep. */
function sampleBeam(length: number, loads: Load[], solved: Solved): Sample[] {
  const samples: Sample[] = [];
  const isCantilever = solved.fixedMoment !== undefined;
  const reactionList = [...solved.reactions].map(([position, force]) => ({ position, force }));

  for (let i = 0; i <= SAMPLE_INTERVALS; i++) {
    const x = (length * i) / SAMPLE_INTERVALS;
    let shear = 0;
    let moment = 0;

    // Forces at or before the section count, so the diagram is defined at x = 0.
    for (const reaction of reactionList) {
      if (reaction.position <= x) {
        shear += reaction.force;
        moment += reaction.force * (x - reaction.position);
      }
    }
    if (isCantilever) {
      moment += solved.couple;
    }

    for (const load of loads) {
      if (load.kind === 'point') {
        if (load.position <= x) {
          shear -= load.magnitude;
          moment -= load.magnitude * (x - load.position);
        }
      } else {
        const covered = Math.max(0, Math.min(load.end, x) - load.start);
        if (covered > 0) {
          const force = load.magnitude * covered;
          const centroid = load.start + covered / 2;
          shear -= force;
          moment -= force * (x - centroid);
        }
      }
    }

    samples.push({ position: x, shear, moment });
  }

  return samples;
}

function extremes(samples: Sample[]): Pick<BeamResult, 'maxSagging' | 'maxHogging'> {
  let maxSagging: BeamResult['maxSagging'] = null;
  let maxHogging: BeamResult['maxHogging'] = null;

  for (const { position, moment } of samples) {
    if (moment > EPSILON && (maxSagging === null || moment > maxSagging.moment)) {
      maxSagging = { position, moment };
    }
    if (moment < -EPSILON && (maxHogging === null || -moment > maxHogging.moment)) {
      maxHogging = { position, moment: -moment };
    }
  }
  return { maxSagging, maxHogging };
}
