import { useId } from 'react';
import { diffDays, formatShort } from '../lib/dates';

export interface Series { label: string; points: { date: string; value: number }[]; style: 'dots' | 'line' | 'bars'; color: string }

interface Props {
  series: Series[];
  unit: string;
  height?: number;
  goal?: number | null;
  decimals?: number;
  ariaLabel: string;
}

const W = 340;

/** Gráfico SVG simple. Solo dibuja días con datos: no interpola ni inventa valores. */
export function Chart({ series, unit, height = 180, goal, decimals = 1, ariaLabel }: Props) {
  const gid = useId().replace(/:/g, '');
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return null;
  const dates = pts.map((p) => p.date).sort();
  const d0 = dates[0], d1 = dates[dates.length - 1];
  const span = Math.max(1, diffDays(d0, d1));
  const hasBars = series.some((s) => s.style === 'bars');
  let lo = Math.min(...pts.map((p) => p.value), goal ?? Infinity);
  let hi = Math.max(...pts.map((p) => p.value), goal ?? -Infinity);
  if (hasBars) lo = 0;
  if (hi === lo) { hi += 1; lo -= hasBars ? 0 : 1; }
  const pad = (hi - lo) * 0.1;
  if (!hasBars) lo -= pad;
  hi += pad;
  const L = 44, R = 10, T = 10, B = 24;
  const iw = W - L - R, ih = height - T - B;
  const x = (d: string) => L + (span === 0 ? iw / 2 : (diffDays(d0, d) / span) * iw);
  const y = (v: number) => T + ih - ((v - lo) / (hi - lo)) * ih;
  const fmt = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: decimals });
  const ticks = [lo + pad * (hasBars ? 0 : 1), (lo + hi) / 2, hi - pad];
  const barW = Math.max(2, Math.min(18, (iw / (span + 1)) * 0.7));

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{fmt(t)}</text>
          </g>
        ))}
        {goal != null && <g><line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} className="goal" /><text x={W - R} y={y(goal) - 4} textAnchor="end" className="axis">meta</text></g>}
        {series.map((s) => {
          const sp = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
          if (s.style === 'bars') return sp.map((p) => (
            <rect className="bar" key={s.label + p.date} x={x(p.date) - barW / 2} y={y(p.value)} width={barW} height={Math.max(0, y(lo) - y(p.value))} style={{ fill: s.color }} rx={3}>
              <title>{`${formatShort(p.date)}: ${fmt(p.value)} ${unit}`}</title>
            </rect>
          ));
          if (s.style === 'line') return (
            <g key={s.label}>
              <defs>
                <linearGradient id={gid + s.label.replace(/\W/g, '')} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.28 }} />
                  <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {sp.length > 1 && <polygon fill={`url(#${gid + s.label.replace(/\W/g, '')})`} points={`${x(sp[0].date)},${y(lo)} ${sp.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} ${x(sp[sp.length - 1].date)},${y(lo)}`} />}
              <polyline className="draw" fill="none" style={{ stroke: s.color }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={sp.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} />
              {sp.map((p) => <rect key={p.date} x={x(p.date) - 4} y={y(p.value) - 4} width={8} height={8} rx={2} style={{ fill: s.color }}><title>{`${s.label} ${formatShort(p.date)}: ${fmt(p.value)} ${unit}`}</title></rect>)}
            </g>
          );
          return sp.map((p) => <circle key={s.label + p.date} cx={x(p.date)} cy={y(p.value)} r={4} style={{ fill: s.color, stroke: 'var(--surface)' }} strokeWidth={1.5}><title>{`${formatShort(p.date)}: ${fmt(p.value)} ${unit}`}</title></circle>);
        })}
        <text x={L} y={height - 6} className="axis">{formatShort(d0)}</text>
        <text x={W - R} y={height - 6} textAnchor="end" className="axis">{formatShort(d1)}</text>
      </svg>
      <figcaption className="legend">
        {series.map((s) => (
          <span key={s.label}><i className={`lg ${s.style}`} style={{ background: s.style === 'line' ? 'transparent' : s.color, borderColor: s.color }} />{s.label}</span>
        ))}
        <span className="muted">({unit})</span>
      </figcaption>
    </figure>
  );
}
