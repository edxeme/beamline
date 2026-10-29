/**
 * Structural domain types. Everything is expressed in SI base units
 * (kN and meters) so the solver never has to care about conversions.
 */

/** A concentrated load applied at a single point. */
export interface PointLoad {
  kind: 'point';
  /** Magnitude in kN. Positive values act downward. */
  magnitude: number;
  /** Distance from the left end of the beam, in meters. */
  position: number;
}

/** A uniformly distributed load applied over a segment. */
export interface UniformLoad {
  kind: 'udl';
  /** Intensity in kN/m. Positive values act downward. */
  magnitude: number;
  /** Segment start, in meters from the left end. */
  start: number;
  /** Segment end, in meters from the left end. */
  end: number;
}

export type Load = PointLoad | UniformLoad;

export type SupportKind = 'pin' | 'roller' | 'fixed';

export interface Support {
  kind: SupportKind;
  /** Distance from the left end of the beam, in meters. */
  position: number;
}

export interface BeamInput {
  /** Span length in meters. */
  length: number;
  supports: Support[];
  loads: Load[];
}

/** One sample of the internal forces along the span. */
export interface Sample {
  /** Distance from the left end, in meters. */
  position: number;
  /** Shear force in kN. Positive means net upward on the left segment. */
  shear: number;
  /** Bending moment in kN·m. Positive means sagging. */
  moment: number;
}

export interface Reaction {
  position: number;
  /** Vertical reaction in kN, positive upward. */
  force: number;
  /** Fixed-end moment in kN·m, present only for `fixed` supports. */
  moment?: number;
}

export interface BeamResult {
  reactions: Reaction[];
  samples: Sample[];
  /** Location and value of the largest sagging moment, if any. */
  maxSagging: { position: number; moment: number } | null;
  /** Location and value of the largest hogging moment (as a positive number), if any. */
  maxHogging: { position: number; moment: number } | null;
}
