import type { Load, Reaction } from '../../core/types';

interface BeamCanvasProps {
  span: number;
  loads: Load[];
  reactions: Reaction[];
}

const WIDTH = 640;
const HEIGHT = 150;
const MARGIN_X = 60;
const BEAM_Y = 92;
const PLOT_W = WIDTH - 2 * MARGIN_X;

export function BeamCanvas({ span, loads, reactions }: BeamCanvasProps) {
  const xOf = (position: number): number => MARGIN_X + (position / span) * PLOT_W;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Beam loading diagram" className="beam-canvas">
      {/* span dimension line */}
      <line x1={MARGIN_X} y1={HEIGHT - 14} x2={WIDTH - MARGIN_X} y2={HEIGHT - 14} className="dim" />
      <text x={WIDTH / 2} y={HEIGHT - 2} className="tick-label" textAnchor="middle">
        L = {span} m
      </text>

      {loads.map((load, index) =>
        load.kind === 'point' ? (
          <PointLoadMark key={index} x={xOf(load.position)} magnitude={load.magnitude} />
        ) : (
          <UniformLoadMark key={index} x1={xOf(load.start)} x2={xOf(load.end)} magnitude={load.magnitude} />
        ),
      )}

      <line x1={MARGIN_X} y1={BEAM_Y} x2={WIDTH - MARGIN_X} y2={BEAM_Y} className="beam" />

      {reactions.map((reaction, index) => (
        <ReactionMark key={index} x={xOf(reaction.position)} force={reaction.force} />
      ))}
    </svg>
  );
}

function PointLoadMark({ x, magnitude }: { x: number; magnitude: number }) {
  const top = 24;
  const tipY = BEAM_Y - 6;
  return (
    <g className="point-load">
      <line x1={x} y1={top} x2={x} y2={tipY - 8} />
      <polygon points={`${x - 5},${tipY - 8} ${x + 5},${tipY - 8} ${x},${tipY}`} />
      <text x={x + 8} y={top + 10} className="load-label">
        {fmt(magnitude)} kN
      </text>
    </g>
  );
}

function UniformLoadMark({ x1, x2, magnitude }: { x1: number; x2: number; magnitude: number }) {
  const top = 40;
  const arrows = 6;
  const step = (x2 - x1) / (arrows - 1);
  const marks = Array.from({ length: arrows }, (_, i) => x1 + i * step);
  return (
    <g className="uniform-load">
      <line x1={x1} y1={top} x2={x2} y2={top} />
      {marks.map((x) => (
        <line key={x} x1={x} y1={top} x2={x} y2={BEAM_Y - 8} className="udl-arrow" />
      ))}
      <text x={(x1 + x2) / 2} y={top - 6} className="load-label" textAnchor="middle">
        {fmt(magnitude)} kN/m
      </text>
    </g>
  );
}

function ReactionMark({ x, force }: { x: number; force: number }) {
  const baseY = BEAM_Y + 26;
  return (
    <g className="reaction">
      <line x1={x} y1={baseY} x2={x} y2={baseY - 10} />
      <polygon points={`${x - 4},${baseY - 10} ${x + 4},${baseY - 10} ${x},${baseY - 17}`} />
      <text x={x} y={baseY + 12} className="load-label" textAnchor="middle">
        R {fmt(force)} kN
      </text>
    </g>
  );
}

function fmt(value: number): string {
  return Number(value.toFixed(2)).toString();
}
