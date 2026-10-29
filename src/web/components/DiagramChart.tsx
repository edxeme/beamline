export interface ChartSample {
  position: number;
  value: number;
}

interface DiagramChartProps {
  title: string;
  unit: string;
  span: number;
  samples: ChartSample[];
  /** SVG color for the filled positive (above-axis) region. */
  positiveColor: string;
  negativeColor: string;
}

const WIDTH = 640;
const HEIGHT = 170;
const MARGIN = { top: 18, right: 16, bottom: 24, left: 48 };

export function DiagramChart({ title, unit, span, samples, positiveColor, negativeColor }: DiagramChartProps) {
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  let min = 0;
  let max = 0;
  for (const { value } of samples) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  // Symmetric scale keeps the zero axis centered, which reads better for diagrams.
  const halfRange = Math.max(Math.abs(min), Math.abs(max), 1e-6);
  const yOf = (value: number): number => MARGIN.top + plotH / 2 - (value / halfRange) * (plotH / 2) * 0.9;
  const xOf = (position: number): number => MARGIN.left + (position / span) * plotW;

  const points = samples.map((s) => `${xOf(s.position).toFixed(2)},${yOf(s.value).toFixed(2)}`);
  const zeroY = yOf(0);

  const areaPath = [
    `M ${points[0] ?? `${MARGIN.left},${zeroY}`}`,
    ...points.slice(1).map((p) => `L ${p}`),
    `L ${xOf(span).toFixed(2)},${zeroY.toFixed(2)}`,
    `L ${MARGIN.left},${zeroY.toFixed(2)}`,
    'Z',
  ].join(' ');

  return (
    <figure className="diagram">
      <figcaption>
        {title} <span className="unit">[{unit}]</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title} diagram`}>
        <defs>
          <clipPath id={`clip-pos-${title}`}>
            <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={Math.max(zeroY - MARGIN.top, 0)} />
          </clipPath>
          <clipPath id={`clip-neg-${title}`}>
            <rect x={MARGIN.left} y={zeroY} width={plotW} height={Math.max(MARGIN.top + plotH - zeroY, 0)} />
          </clipPath>
        </defs>

        <line x1={MARGIN.left} y1={zeroY} x2={WIDTH - MARGIN.right} y2={zeroY} className="axis" />

        {[0, span / 2, span].map((tick) => (
          <g key={tick}>
            <line x1={xOf(tick)} y1={zeroY - 4} x2={xOf(tick)} y2={zeroY + 4} className="tick" />
            <text x={xOf(tick)} y={HEIGHT - 6} className="tick-label" textAnchor="middle">
              {fmt(tick)} m
            </text>
          </g>
        ))}

        <path d={areaPath} fill={positiveColor} clipPath={`url(#clip-pos-${title})`} />
        <path d={areaPath} fill={negativeColor} clipPath={`url(#clip-neg-${title})`} />
        <polyline points={points.join(' ')} className="curve" />

        {max !== 0 && (
          <text x={MARGIN.left + 6} y={MARGIN.top + 4} className="peak peak-pos">
            +{fmt(max)}
          </text>
        )}
        {min !== 0 && (
          <text x={MARGIN.left + 6} y={MARGIN.top + plotH - 2} className="peak peak-neg">
            {fmt(min)}
          </text>
        )}
      </svg>
    </figure>
  );
}

function fmt(value: number): string {
  return Number(value.toFixed(2)).toString();
}
