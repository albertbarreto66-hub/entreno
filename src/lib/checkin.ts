import { addDays, weekStart } from './dates';
import { doneSets, normName } from './training';
import { weeklyAverages, type Point } from './trends';
import type { WorkoutSession } from './types';

/**
 * Control semanal: decide si mantener, ajustar calorías o ajustar volumen.
 * Usa promedios semanales (no días sueltos) y pide adherencia antes de tocar calorías.
 * Ritmo buscado: perder ~0,5–1 % del peso por semana conservando la fuerza.
 */
export interface WeekInput {
  today: string;
  programWeek: number;
  weights: Point[];
  waists: Point[];
  adherence: number | null; // 0–1: días con las 4 comidas registradas (últimos 7)
  trainingsDone: number;
  trainingsPlanned: number;
  sleepAvg: number | null;
  stepsAvg: number | null;
  strength: { up: number; down: number; same: number };
  checkin?: { energy: number; hunger: number; recovery: number } | null;
}

export type CheckStatus = 'sin-datos' | 'adherencia' | 'lento' | 'en-rango' | 'rapido';
export interface WeekResult {
  status: CheckStatus;
  title: string;
  rate: number | null; // % de peso perdido en la última semana (positivo = bajó)
  weekAvg: number | null;
  prevAvg: number | null;
  waistChange: number | null; // cm en ~2 semanas (negativo = bajó)
  kcalDelta: number; // sugerencia, requiere aceptación
  volume: 'mantener' | 'reducir';
  actions: string[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (v: number, d = 1) => v.toLocaleString('es-AR', { maximumFractionDigits: d });

export function evaluateWeek(i: WeekInput): WeekResult {
  const weeks = weeklyAverages(i.weights).filter((w) => w.n >= 2 && w.week <= weekStart(i.today));
  const actions: string[] = [];
  const cur = weeks.at(-1) ?? null, prev = weeks.at(-2) ?? null, prev2 = weeks.at(-3) ?? null;
  const rate = cur && prev ? ((prev.avg - cur.avg) / prev.avg) * 100 : null;
  const ratePrev = prev && prev2 ? ((prev2.avg - prev.avg) / prev2.avg) * 100 : null;
  const recentWaist = i.waists.filter((p) => p.date >= addDays(i.today, -16)).sort((a, b) => a.date.localeCompare(b.date));
  const waistChange = recentWaist.length >= 2 ? recentWaist.at(-1)!.value - recentWaist[0].value : null;

  const fatigued = i.strength.down >= 3 || (i.checkin != null && (i.checkin.recovery <= 2 || i.checkin.energy <= 2)) || (i.sleepAvg != null && i.sleepAvg < 6);
  const volume: WeekResult['volume'] = fatigued ? 'reducir' : 'mantener';
  if (fatigued) actions.push('Recuperación baja (fuerza en caída, poca energía o menos de 6 h de sueño): esta semana usá "Hoy estoy cansado" (una serie menos) y priorizá dormir 7–8 h.');
  if (i.checkin && i.checkin.hunger >= 4) actions.push('Hambre alta: sumá verduras y fruta, comé despacio y no saltees la merienda. No es momento de bajar calorías.');

  const base = { rate, weekAvg: cur?.avg ?? null, prevAvg: prev?.avg ?? null, waistChange, volume };
  if (rate == null) {
    return { ...base, status: 'sin-datos', title: 'Faltan datos para evaluar', kcalDelta: 0,
      actions: ['Pesate al menos 3 días por semana (en ayunas) durante 2 semanas para ver la tendencia.', ...actions] };
  }
  if (i.adherence != null && i.adherence < 0.8) {
    return { ...base, status: 'adherencia', title: 'Primero, constancia', kcalDelta: 0,
      actions: [`Registraste las 4 comidas en ${Math.round(i.adherence * 7)} de 7 días. Antes de cambiar calorías, apuntá a 6 de 7 y pesá las porciones.`, ...actions] };
  }
  const slow = rate < 0.25 && (ratePrev == null || ratePrev < 0.25) && (waistChange == null || waistChange > -0.5);
  const fast = rate > 1.0 && (ratePrev == null || ratePrev > 1.0 || i.strength.down >= 2) && i.programWeek > 2;
  if (slow && ratePrev != null) {
    if (fatigued) {
      return { ...base, status: 'lento', title: 'Estancado, pero con poca recuperación', kcalDelta: 0,
        actions: [...actions, 'No bajes calorías con la recuperación así: primero sueño y una semana más liviana; revisamos la próxima semana.'] };
    }
    return { ...base, status: 'lento', title: 'El peso promedio casi no se movió 2 semanas', kcalDelta: -150,
      actions: ['Bajá ~150 kcal por día: sacá 40 g de arroz o fideos (crudos) o 50 g de pan del almuerzo.',
        (i.stepsAvg ?? 0) < 14000 ? 'O, en lugar de comer menos, sumá ~1.000 pasos diarios si te recuperás bien.' : 'Tus pasos ya están altos: preferí el ajuste de comida.',
        'Antes de aplicar: confirmá que pesás las porciones y que el aceite está medido.', ...actions] };
  }
  if (fast) {
    return { ...base, status: 'rapido', title: 'Estás bajando más rápido de lo buscado', kcalDelta: 150,
      actions: ['Sumá ~150 kcal por día para cuidar la fuerza y el músculo: una fruta más y 15 g de almendras, o 40 g más de arroz en el almuerzo.', ...actions] };
  }
  const note = i.programWeek <= 2 && rate > 1 ? ' Las primeras 2 semanas suele bajar más por agua: es normal.' : '';
  return { ...base, status: 'en-rango', title: 'Vas en el ritmo buscado', kcalDelta: 0,
    actions: [`Bajaste ${fmt(rate)} % del peso esta semana (promedio ${fmt(prev!.avg)} → ${fmt(cur!.avg)} kg).${note} Mantené el plan.`, ...actions] };
}

/** Compara la mejor serie (1RM estimado) de cada ejercicio entre su última sesión y la anterior, en las últimas 2 semanas. */
export function strengthTrend(sessions: WorkoutSession[], today: string) {
  const from = addDays(today, -14);
  const byEx = new Map<string, { date: string; e1rm: number }[]>();
  for (const s of sessions) {
    if (s.status === 'omitida' || s.noDetail) continue;
    for (const e of s.exercises) {
      const ds = doneSets(e).filter((x) => x.kg != null && x.kg > 0);
      if (!ds.length || e.skipped) continue;
      const best = Math.max(...ds.map((x) => (x.kg as number) * (1 + (x.reps ?? 0) / 30)));
      const k = normName(e.name);
      if (!byEx.has(k)) byEx.set(k, []);
      byEx.get(k)!.push({ date: s.date, e1rm: best });
    }
  }
  let up = 0, down = 0, same = 0;
  for (const list of byEx.values()) {
    const l = list.sort((a, b) => a.date.localeCompare(b.date));
    const last = l.at(-1)!;
    if (last.date < from || l.length < 2) continue;
    const prev = l.at(-2)!;
    const d = (last.e1rm - prev.e1rm) / prev.e1rm;
    if (d > 0.01) up++; else if (d < -0.02) down++; else same++;
  }
  return { up, down, same };
}

export const avgOf = avg;
