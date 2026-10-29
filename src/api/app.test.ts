import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const app = createApp();

const validBeam = {
  length: 6,
  supports: [
    { kind: 'pin', position: 0 },
    { kind: 'roller', position: 6 },
  ],
  loads: [{ kind: 'point', magnitude: 10, position: 3 }],
};

describe('GET /api/v1/health', () => {
  it('reports service health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/v1/beams/analysis', () => {
  it('returns reactions and sampled diagrams', async () => {
    const res = await request(app).post('/api/v1/beams/analysis').send(validBeam);

    expect(res.status).toBe(201);
    expect(res.body.reactions).toHaveLength(2);
    expect(res.body.reactions[0].force).toBeCloseTo(5, 6);
    expect(res.body.samples).toHaveLength(401);
    expect(res.body.maxSagging.moment).toBeCloseTo(15, 0);
  });

  it('rejects malformed payloads with field-level details', async () => {
    const res = await request(app)
      .post('/api/v1/beams/analysis')
      .send({ length: 'six', supports: [], loads: [{ kind: 'spiral' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('request/invalid');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.stringContaining('length'), expect.stringContaining('loads[0].kind')]),
    );
  });

  it('translates domain errors into 400 responses', async () => {
    const res = await request(app)
      .post('/api/v1/beams/analysis')
      .send({ ...validBeam, loads: [{ kind: 'point', magnitude: 1, position: 99 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('load/out-of-span');
  });
});

describe('GET /api/v1/convert', () => {
  it('converts forces between units', async () => {
    const res = await request(app).get('/api/v1/convert').query({ quantity: 'force', value: 1, from: 'kip', to: 'kN' });

    expect(res.status).toBe(200);
    expect(res.body.converted).toBeCloseTo(4.4482216152605, 9);
  });

  it('converts lengths between units', async () => {
    const res = await request(app).get('/api/v1/convert').query({ quantity: 'length', value: 1, from: 'ft', to: 'm' });

    expect(res.status).toBe(200);
    expect(res.body.converted).toBeCloseTo(0.3048, 9);
  });

  it('rejects unknown units with a 400', async () => {
    const res = await request(app).get('/api/v1/convert').query({ quantity: 'force', value: 1, from: 'stone', to: 'kN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('request/invalid');
  });
});
