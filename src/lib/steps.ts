import { STEP_GOAL_MAX } from '../data/profile';
import type { DayLog, HealthRecord, Settings, SourceKind } from './types';

export interface DaySteps {
  value: number | null; // null = sin datos (no es cero)
  origin: SourceKind | null;
  sourceName?: string;
  countsForGoal: boolean; // según la base elegida (reloj o manual permitido)
  manual: number | null;
  watch: number | null;
  phone: number | null;
}

/** Proporción del intervalo [s,e) que cae dentro de [ds,de). */
export function overlapFraction(s: number, e: number, ds: number, de: number) {
  if (e <= s) return s >= ds && s < de ? 1 : 0;
  const ov = Math.max(0, Math.min(e, de) - Math.max(s, ds));
  return ov / (e - s);
}

/**
 * Suma de pasos de UNA fuente dentro del día local, prorrateando muestras que cruzan medianoche.
 * Excluye registros marcados como ingresados a mano en Salud.
 */
export function sumStepsForSource(recs: HealthRecord[], dayStart: number, dayEnd: number, pred: (r: HealthRecord) => boolean) {
  let total = 0, any = false;
  for (const r of recs) {
    if (r.type !== 'steps' || r.userEntered || !pred(r)) continue;
    const f = overlapFraction(r.start, r.end, dayStart, dayEnd);
    if (f > 0) { total += r.value * f; any = true; }
  }
  return any ? Math.round(total) : null;
}

/**
 * Política de pasos: nunca se suman fuentes distintas (reloj + iPhone contarían doble).
 * Se usa la fuente preferida; si no tiene datos, la otra automática; si no, el registro manual.
 */
export function resolveDaySteps(
  day: DayLog | undefined, recs: HealthRecord[], dayStart: number, dayEnd: number,
  settings: Pick<Settings, 'stepGoalBasis' | 'stepSource' | 'watchSourceId'>,
): DaySteps {
  const isWatch = (r: HealthRecord) => (settings.watchSourceId ? r.sourceId === settings.watchSourceId : r.kind === 'garmin');
  const watch = sumStepsForSource(recs, dayStart, dayEnd, isWatch);
  const phone = sumStepsForSource(recs, dayStart, dayEnd, (r) => r.kind === 'iphone');
  const manual = day?.stepsManual ?? null;
  const watchRec = recs.find((r) => r.type === 'steps' && isWatch(r));
  const base = { manual, watch, phone };
  const prefWatch = settings.stepSource !== 'iphone';
  const order: Array<'watch' | 'phone'> = prefWatch ? ['watch', 'phone'] : ['phone', 'watch'];
  for (const o of order) {
    const v = o === 'watch' ? watch : phone;
    if (v != null) {
      const origin: SourceKind = o === 'watch' ? (watchRec?.kind ?? 'garmin') : 'iphone';
      const countsForGoal = settings.stepGoalBasis === 'reloj' ? o === 'watch' : true;
      return { ...base, value: v, origin, sourceName: o === 'watch' ? watchRec?.sourceName : 'iPhone', countsForGoal };
    }
  }
  if (manual != null) return { ...base, value: manual, origin: 'manual', countsForGoal: settings.stepGoalBasis !== 'reloj' };
  return { ...base, value: null, origin: null, countsForGoal: false };
}

export function stepGoalMet(s: DaySteps, goal: number | null) {
  return goal != null && s.value != null && s.countsForGoal && s.value >= goal;
}

export interface WeekReviewInput {
  days: { date: string; steps: number | null; goal: number | null; met: boolean; pain?: number; recoveryFeel?: string; sleepHours?: number | null; recovery?: boolean }[];
  currentGoal: number;
}
export interface WeekReview {
  canIncrease: boolean;
  suggested: number | null;
  daysWithData: number;
  daysMet: number;
  reasons: string[];
}

/** Revisión semanal: sugiere +500 solo si hubo cumplimiento, sin dolor y con buena recuperación. Nunca aplica cambios. */
export function reviewStepWeek({ days, currentGoal }: WeekReviewInput): WeekReview {
  const reasons: string[] = [];
  const withData = days.filter((d) => d.steps != null);
  const met = days.filter((d) => d.met).length;
  const painDays = days.filter((d) => (d.pain ?? 0) >= 2).length;
  const badRecovery = days.filter((d) => d.recoveryFeel === 'mala').length;
  const sleeps = days.map((d) => d.sleepHours).filter((h): h is number => h != null);
  const avgSleep = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;

  if (withData.length < 5) reasons.push(`Hay datos de ${withData.length} de 7 días: no alcanza para evaluar.`);
  if (met < 5) reasons.push(`Meta alcanzada ${met} días: conviene mantenerla.`);
  if (painDays > 0) reasons.push(`Registraste dolor moderado o fuerte ${painDays} día(s).`);
  if (badRecovery > 0) reasons.push(`Marcaste recuperación mala ${badRecovery} día(s).`);
  if (avgSleep != null && avgSleep < 6.5) reasons.push(`Sueño promedio ${avgSleep.toFixed(1)} h.`);
  if (currentGoal + 500 > STEP_GOAL_MAX) reasons.push(`La plantilla no supera ${STEP_GOAL_MAX.toLocaleString('es-AR')} pasos.`);
  const canIncrease = reasons.length === 0;
  if (canIncrease) reasons.push(`Meta alcanzada ${met} de 7 días, sin dolor registrado y con recuperación aceptable.`);
  return { canIncrease, suggested: canIncrease ? currentGoal + 500 : null, daysWithData: withData.length, daysMet: met, reasons };
}
