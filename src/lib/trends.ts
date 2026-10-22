import { diffDays, weekStart } from './dates';

export interface Point { date: string; value: number }

/** Promedio por semana (lunes) usando solo días con registro. No interpola días faltantes. */
export function weeklyAverages(points: Point[]): { week: string; avg: number; n: number }[] {
  const m = new Map<string, number[]>();
  for (const p of points) {
    const w = weekStart(p.date);
    if (!m.has(w)) m.set(w, []);
    m.get(w)!.push(p.value);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([week, vs]) => ({ week, avg: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length }));
}

/** Un valor por día: si hay varias mediciones el mismo día, se promedian. */
export function dailyMean(points: Point[]): Point[] {
  const m = new Map<string, number[]>();
  for (const p of points) { if (!m.has(p.date)) m.set(p.date, []); m.get(p.date)!.push(p.value); }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, vs]) => ({ date, value: vs.reduce((a, b) => a + b, 0) / vs.length }));
}

export interface TrendResult {
  enough: boolean;
  message: string;
  change?: number; // diferencia entre el promedio de la última semana y el de la primera comparada
}

/**
 * Tendencia de peso o cintura. Exige al menos dos semanas con datos y 14 días de rango.
 * Nunca recomienda recortar calorías por una medición aislada.
 */
export function trend(points: Point[], unit: 'kg' | 'cm', threshold = unit === 'kg' ? 0.2 : 0.5): TrendResult {
  const daily = dailyMean(points);
  const weeks = weeklyAverages(daily);
  if (daily.length < 2 || weeks.length < 2 || diffDays(daily[0].date, daily[daily.length - 1].date) < 13) {
    return { enough: false, message: 'Hacen falta al menos dos semanas de registros para ver una tendencia. Un día aislado no dice mucho.' };
  }
  const last = weeks[weeks.length - 1];
  const prev = weeks[Math.max(0, weeks.length - 3)]; // comparar con ~2 semanas antes si existe
  const change = last.avg - prev.avg;
  const fmt = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 });
  if (Math.abs(change) < threshold) {
    return { enough: true, change, message: `Promedio semanal estable (${fmt(prev.avg)} → ${fmt(last.avg)} ${unit}). Antes de cambiar el plan, revisá constancia en los registros, porciones y recuperación.` };
  }
  const dir = change < 0 ? 'bajó' : 'subió';
  return { enough: true, change, message: `El promedio semanal ${dir} ${fmt(Math.abs(change))} ${unit} (${fmt(prev.avg)} → ${fmt(last.avg)}). Es una tendencia, no un juicio: los días sueltos varían por agua, sal y digestión.` };
}
