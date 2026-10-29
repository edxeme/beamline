import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BeamInput, Load } from '../core/types';
import { ApiRequestError, analyzeBeamRemote, convertUnit, type AnalysisResponse } from './api';
import { BeamCanvas } from './components/BeamCanvas';
import { DiagramChart } from './components/DiagramChart';

type Layout = 'simple' | 'cantilever-left' | 'cantilever-right';

interface LoadDraft {
  id: string;
  kind: 'point' | 'udl';
  magnitude: string;
  position: string;
  start: string;
  end: string;
}

interface BeamForm {
  span: string;
  layout: Layout;
  loads: LoadDraft[];
}

const DEFAULT_FORM: BeamForm = {
  span: '6',
  layout: 'simple',
  loads: [
    { id: 'a', kind: 'point', magnitude: '10', position: '3', start: '', end: '' },
    { id: 'b', kind: 'udl', magnitude: '2', position: '', start: '0', end: '6' },
  ],
};

let draftCounter = 0;
const nextId = (): string => `load-${++draftCounter}`;

export function App() {
  const [form, setForm] = useState<BeamForm>(DEFAULT_FORM);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const span = Number(form.span);
  const supports = useMemo(() => supportsFor(form.layout, span), [form.layout, span]);
  const loads = useMemo(() => parseLoads(form.loads), [form.loads]);

  useEffect(() => {
    if (!isFinite(span) || span <= 0) {
      setError('Span must be a positive number.');
      setResult(null);
      return;
    }
    const controller = new AbortController();
    const input: BeamInput = { length: span, supports, loads };
    analyzeBeamRemote(input, controller.signal)
      .then((res) => {
        setResult(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiRequestError ? describeError(err) : 'Unexpected error. Is the API running?');
        setResult(null);
      });
    return () => controller.abort();
  }, [span, supports, loads]);

  const updateLoad = useCallback((id: string, patch: Partial<LoadDraft>) => {
    setForm((prev) => ({
      ...prev,
      loads: prev.loads.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    }));
  }, []);

  return (
    <main className="layout">
      <header className="masthead">
        <h1>
          beam<span className="accent">line</span>
        </h1>
        <p className="tagline">
          Quick statics for everyday beams — model it, hit the API, read the diagrams.
        </p>
      </header>

      <div className="panels">
        <section className="card form-card">
          <h2>Model</h2>

          <label className="field">
            <span>Span L [m]</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={form.span}
              onChange={(e) => setForm((prev) => ({ ...prev, span: e.target.value }))}
            />
          </label>

          <label className="field">
            <span>Support layout</span>
            <select
              value={form.layout}
              onChange={(e) => setForm((prev) => ({ ...prev, layout: e.target.value as Layout }))}
            >
              <option value="simple">Simply supported</option>
              <option value="cantilever-left">Cantilever, fixed left</option>
              <option value="cantilever-right">Cantilever, fixed right</option>
            </select>
          </label>

          <h3>
            Loads{' '}
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  loads: [
                    ...prev.loads,
                    { id: nextId(), kind: 'point', magnitude: '5', position: '1.5', start: '', end: '' },
                  ],
                }))
              }
            >
              + add load
            </button>
          </h3>

          {form.loads.map((draft) => (
            <fieldset key={draft.id} className="load-row">
              <legend>
                {draft.kind === 'point' ? 'Point load' : 'Uniform load'}
                <button
                  type="button"
                  className="ghost remove"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, loads: prev.loads.filter((l) => l.id !== draft.id) }))
                  }
                >
                  remove
                </button>
              </legend>

              <label>
                <span>{draft.kind === 'point' ? 'P [kN]' : 'w [kN/m]'}</span>
                <input
                  type="number"
                  step="0.5"
                  value={draft.magnitude}
                  onChange={(e) => updateLoad(draft.id, { magnitude: e.target.value })}
                />
              </label>

              {draft.kind === 'point' ? (
                <label>
                  <span>at x [m]</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={draft.position}
                    onChange={(e) => updateLoad(draft.id, { position: e.target.value })}
                  />
                </label>
              ) : (
                <span className="pair">
                  <label>
                    <span>from [m]</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={draft.start}
                      onChange={(e) => updateLoad(draft.id, { start: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>to [m]</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={draft.end}
                      onChange={(e) => updateLoad(draft.id, { end: e.target.value })}
                    />
                  </label>
                </span>
              )}

              <label>
                <span>type</span>
                <select
                  value={draft.kind}
                  onChange={(e) => updateLoad(draft.id, { kind: e.target.value as LoadDraft['kind'] })}
                >
                  <option value="point">point</option>
                  <option value="udl">uniform</option>
                </select>
              </label>
            </fieldset>
          ))}

          <UnitConverter />
        </section>

        <section className="results">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {result && (
            <>
              <div className="card">
                <BeamCanvas span={result.input.length} loads={result.input.loads} reactions={result.reactions} />
              </div>

              <div className="card">
                <div className="stats">
                  {result.reactions.map((reaction) => (
                    <div key={reaction.position} className="stat">
                      <span className="stat-label">reaction @ {reaction.position} m</span>
                      <span className="stat-value">{reaction.force.toFixed(2)} kN</span>
                      {reaction.moment !== undefined && (
                        <span className="stat-sub">M_fix {reaction.moment.toFixed(2)} kN·m</span>
                      )}
                    </div>
                  ))}
                  {result.maxSagging && (
                    <div className="stat">
                      <span className="stat-label">max sagging @ {result.maxSagging.position.toFixed(2)} m</span>
                      <span className="stat-value">{result.maxSagging.moment.toFixed(2)} kN·m</span>
                    </div>
                  )}
                  {result.maxHogging && (
                    <div className="stat">
                      <span className="stat-label">max hogging @ {result.maxHogging.position.toFixed(2)} m</span>
                      <span className="stat-value">{result.maxHogging.moment.toFixed(2)} kN·m</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <DiagramChart
                  title="Shear"
                  unit="kN"
                  span={result.input.length}
                  samples={result.samples.map((s) => ({ position: s.position, value: s.shear }))}
                  positiveColor="var(--shear-pos)"
                  negativeColor="var(--shear-neg)"
                />
              </div>

              <div className="card">
                <DiagramChart
                  title="Moment"
                  unit="kN·m"
                  span={result.input.length}
                  samples={result.samples.map((s) => ({ position: s.position, value: s.moment }))}
                  positiveColor="var(--moment-pos)"
                  negativeColor="var(--moment-neg)"
                />
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="foot">
        <span>beamline — a statics playground that stayed honest to its roots.</span>
      </footer>
    </main>
  );
}

function UnitConverter() {
  const [quantity, setQuantity] = useState<'force' | 'length'>('force');
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState('kip');
  const [to, setTo] = useState('kN');
  const [converted, setConverted] = useState<string | null>(null);

  const units = quantity === 'force' ? ['N', 'kN', 'lbf', 'kip'] : ['mm', 'm', 'in', 'ft'];

  const run = useCallback(async () => {
    try {
      const res = await convertUnit(quantity, Number(value), from, to);
      setConverted(res.converted.toFixed(4));
    } catch {
      setConverted('—');
    }
  }, [quantity, value, from, to]);

  return (
    <div className="converter">
      <h3>Unit converter</h3>
      <div className="converter-row">
        <select
          value={quantity}
          onChange={(e) => {
            const q = e.target.value as 'force' | 'length';
            setQuantity(q);
            setFrom(q === 'force' ? 'kip' : 'ft');
            setTo(q === 'force' ? 'kN' : 'm');
            setConverted(null);
          }}
        >
          <option value="force">force</option>
          <option value="length">length</option>
        </select>
        <input type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} />
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="arrow">→</span>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void run()}>
          convert
        </button>
      </div>
      {converted !== null && (
        <p className="converted">
          {converted} {to}
        </p>
      )}
    </div>
  );
}

function supportsFor(layout: Layout, span: number): BeamInput['supports'] {
  if (layout === 'cantilever-left') return [{ kind: 'fixed', position: 0 }];
  if (layout === 'cantilever-right') return [{ kind: 'fixed', position: span }];
  return [
    { kind: 'pin', position: 0 },
    { kind: 'roller', position: span },
  ];
}

function parseLoads(drafts: LoadDraft[]): Load[] {
  return drafts.flatMap((draft): Load[] => {
    const magnitude = Number(draft.magnitude);
    if (draft.kind === 'point') {
      const position = Number(draft.position);
      return isFinite(magnitude) && isFinite(position) ? [{ kind: 'point', magnitude, position }] : [];
    }
    const start = Number(draft.start);
    const end = Number(draft.end);
    return isFinite(magnitude) && isFinite(start) && isFinite(end)
      ? [{ kind: 'udl', magnitude, start, end }]
      : [];
  });
}

function describeError(err: ApiRequestError): string {
  if (err.details && err.details.length > 0) {
    return `${err.message} — ${err.details.join(' ')}`;
  }
  return `${err.code}: ${err.message}`;
}
