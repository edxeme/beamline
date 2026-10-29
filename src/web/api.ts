import type { BeamInput, BeamResult } from '../core/types';

export interface ApiError {
  code: string;
  message: string;
  details?: string[];
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly details?: string[];
  readonly status: number;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

export interface AnalysisResponse extends BeamResult {
  input: BeamInput;
}

export async function analyzeBeamRemote(input: BeamInput, signal?: AbortSignal): Promise<AnalysisResponse> {
  const res = await fetch('/api/v1/beams/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, body.error as ApiError);
  }
  return body as AnalysisResponse;
}

export interface ConversionResponse {
  quantity: 'force' | 'length';
  value: number;
  from: string;
  to: string;
  converted: number;
}

export async function convertUnit(
  quantity: 'force' | 'length',
  value: number,
  from: string,
  to: string,
): Promise<ConversionResponse> {
  const query = new URLSearchParams({ quantity, value: String(value), from, to });
  const res = await fetch(`/api/v1/convert?${query.toString()}`);
  const body = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, body.error as ApiError);
  }
  return body as ConversionResponse;
}
