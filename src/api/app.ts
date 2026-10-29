import express, { type NextFunction, type Request, type Response } from 'express';
import { BeamError, analyzeBeam } from '../core/beam';
import { forceFromKilonewtons, forceToKilonewtons, lengthFromMeters, lengthToMeters } from '../core/units';
import { ValidationError, parseBeamPayload, parseConvertQuery } from './validate';

/** Maps domain and validation errors to HTTP responses; unknown errors rethrow. */
function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: { code: 'request/invalid', message: err.message, details: err.details } });
    return;
  }
  if (err instanceof BeamError) {
    res.status(400).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/v1/beams/analysis', (req, res) => {
    const input = parseBeamPayload(req.body);
    const result = analyzeBeam(input);
    res.status(201).json({ input, ...result });
  });

  app.get('/api/v1/convert', (req, res) => {
    const { quantity, value, from, to } = parseConvertQuery(req.query as Record<string, unknown>);
    let converted: number;
    if (quantity === 'force') {
      converted = forceFromKilonewtons(forceToKilonewtons(value, from as never), to as never);
    } else {
      converted = lengthFromMeters(lengthToMeters(value, from as never), to as never);
    }
    res.json({ quantity, value, from, to, converted });
  });

  app.use(errorHandler);

  return app;
}
