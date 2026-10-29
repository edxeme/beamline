/**
 * Minimal request validation. Hand-rolled on purpose: the payloads are small,
 * the rules are domain-specific, and type guards keep the inference exact
 * without pulling in a schema library.
 */

import type { Load, Support } from '../core/types';

export class ValidationError extends Error {
  readonly details: string[];

  constructor(details: string[]) {
    super(details[0] ?? 'Invalid request payload.');
    this.name = 'ValidationError';
    this.details = details;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function num(source: Record<string, unknown>, key: string, label: string, details: string[]): number {
  const value = source[key];
  if (typeof value !== 'number' || !isFinite(value)) {
    details.push(`${label} must be a finite number.`);
    return NaN;
  }
  return value;
}

/** Query-string parameters always arrive as strings; coerce then validate. */
function coerceNum(source: Record<string, unknown>, key: string, label: string, details: string[]): number {
  const raw = source[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !isFinite(value)) {
    details.push(`${label} must be a finite number.`);
    return NaN;
  }
  return value;
}

function str(source: Record<string, unknown>, key: string, label: string, details: string[], allowed: readonly string[]): string {
  const value = source[key];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    details.push(`${label} must be one of: ${allowed.join(', ')}.`);
    return '';
  }
  return value;
}

export function parseBeamPayload(body: unknown): { length: number; supports: Support[]; loads: Load[] } {
  const details: string[] = [];
  if (!isRecord(body)) {
    throw new ValidationError(['Request body must be a JSON object.']);
  }

  const length = num(body, 'length', 'length', details);

  const rawSupports = body.supports;
  if (!Array.isArray(rawSupports) || rawSupports.length === 0) {
    details.push('supports must be a non-empty array.');
  }
  const supports: Support[] = [];
  for (const [index, raw] of Array.isArray(rawSupports) ? rawSupports.entries() : []) {
    if (!isRecord(raw)) {
      details.push(`supports[${index}] must be an object.`);
      continue;
    }
    const kind = str(raw, 'kind', `supports[${index}].kind`, details, ['pin', 'roller', 'fixed']);
    const position = num(raw, 'position', `supports[${index}].position`, details);
    if (kind && !isNaN(position)) {
      supports.push({ kind: kind as Support['kind'], position });
    }
  }

  const rawLoads = body.loads ?? [];
  const loads: Load[] = [];
  if (!Array.isArray(rawLoads)) {
    details.push('loads must be an array.');
  } else {
    for (const [index, raw] of rawLoads.entries()) {
      if (!isRecord(raw)) {
        details.push(`loads[${index}] must be an object.`);
        continue;
      }
      const kind = str(raw, 'kind', `loads[${index}].kind`, details, ['point', 'udl']);
      if (!kind) continue;

      if (kind === 'point') {
        const magnitude = num(raw, 'magnitude', `loads[${index}].magnitude`, details);
        const position = num(raw, 'position', `loads[${index}].position`, details);
        if (!isNaN(magnitude) && !isNaN(position)) {
          loads.push({ kind: 'point', magnitude, position });
        }
      } else {
        const magnitude = num(raw, 'magnitude', `loads[${index}].magnitude`, details);
        const start = num(raw, 'start', `loads[${index}].start`, details);
        const end = num(raw, 'end', `loads[${index}].end`, details);
        if (!isNaN(magnitude) && !isNaN(start) && !isNaN(end)) {
          loads.push({ kind: 'udl', magnitude, start, end });
        }
      }
    }
  }

  if (details.length > 0) {
    throw new ValidationError(details);
  }
  return { length, supports, loads };
}

const FORCE_UNITS = ['N', 'kN', 'lbf', 'kip'] as const;
const LENGTH_UNITS = ['mm', 'm', 'in', 'ft'] as const;

export function parseConvertQuery(query: Record<string, unknown>): {
  quantity: 'force' | 'length';
  value: number;
  from: string;
  to: string;
} {
  const details: string[] = [];
  const quantity = str(query, 'quantity', 'quantity', details, ['force', 'length']);
  const value = coerceNum(query, 'value', 'value', details);
  const from = str(query, 'from', 'from', details, quantity === 'length' ? LENGTH_UNITS : FORCE_UNITS);
  const to = str(query, 'to', 'to', details, quantity === 'length' ? LENGTH_UNITS : FORCE_UNITS);

  if (details.length > 0) {
    throw new ValidationError(details);
  }
  return { quantity: quantity as 'force' | 'length', value, from, to };
}
