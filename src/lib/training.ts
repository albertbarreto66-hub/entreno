import { DEFAULT_TEMPLATES } from '../data/templates';
import { diffDays, weekday } from './dates';
import { kvGet } from './db';
import { uid } from './format';
import type { DayTemplate, ExerciseLog, ExerciseTemplate, SetLog, WorkoutSession } from './types';

export async function getTemplates(): Promise<DayTemplate[]> {
  return (await kvGet<DayTemplate[]>('templates')) ?? DEFAULT_TEMPLATES;
}

export function templateForDate(templates: DayTemplate[], date: string) {
  return templates.find((t) => t.weekday === weekday(date)) ?? null;
}

/** Semana de programa (1 = primera) a partir de la fecha de inicio. */
export function programWeek(start: string | null | undefined, date: string) {
  if (!start) return 1;
  return Math.max(1, Math.floor(diffDays(start, date) / 7) + 1);
}

export function plannedSetsFor(t: ExerciseTemplate, adaptation: boolean, reduced: boolean) {
  let n = t.sets;
  if (adaptation) n = Math.min(n, 2);
  if (reduced) n = Math.max(1, n - 1);
  return n;
}

const emptySet = (): SetLog => ({ kg: null, reps: null, rir: null, done: false });

/** Crea una sesión nueva sin pesos precargados. */
export function newSession(t: DayTemplate, date: string, opts: { adaptation: boolean; reducedSets: boolean }): WorkoutSession {
  const now = Date.now();
  return {
    id: uid(), date, templateId: t.id, templateName: t.name, status: 'en-curso',
    adaptation: opts.adaptation, reducedSets: opts.reducedSets, preCheck: { knee: null, breathing: null },
    exercises: t.exercises.map((e) => {
      const n = plannedSetsFor(e, opts.adaptation, opts.reducedSets);
      return {
        exerciseId: e.id, name: e.name, plannedSets: n, repMin: e.repMin, repMax: e.repMax,
        warmups: [], sets: Array.from({ length: n }, emptySet), pain: 0, techniqueOk: null, skipped: null, notes: '',
      };
    }),
    startedAt: now, updatedAt: now,
  };
}

export const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function sameExercise(a: ExerciseLog, id: string, name: string) {
  return a.exerciseId === id || normName(a.name) === normName(name);
}

export const doneSets = (e: ExerciseLog) => e.sets.filter((s) => s.done && s.reps != null);

/** Registros anteriores del ejercicio (más reciente primero), excluyendo la sesión actual y las omitidas. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string, name: string, excludeSessionId?: string) {
  return sessions
    .filter((s) => s.id !== excludeSessionId && s.status !== 'omitida' && !s.noDetail)
    .flatMap((s) => s.exercises.filter((e) => sameExercise(e, exerciseId, name) && !e.skipped && doneSets(e).length > 0).map((e) => ({ session: s, ex: e })))
    .sort((a, b) => (b.session.date + b.session.startedAt).localeCompare(a.session.date + a.session.startedAt));
}

export function describeSets(e: ExerciseLog) {
  const ds = doneSets(e);
  if (!ds.length) return 'sin series efectivas';
  return ds.map((s) => `${s.kg != null ? fmtKg(s.kg) + ' kg' : 'sin carga'} × ${s.reps}${s.rir != null ? ` (RIR ${s.rir})` : ''}`).join(' · ');
}
export const fmtKg = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export interface SuggestionContext {
  repeatWeek: boolean;
  dayRecoveryFeel?: 'buena' | 'normal' | 'mala';
  sleepHours?: number | null;
  incrementKg: number;
}
export interface Suggestion { suggest: boolean; newKg: number | null; reasons: string[] }

/**
 * Sugerencia de progresión para la próxima sesión. Requiere aceptación: no modifica nada.
 * Solo sugiere subir el mínimo disponible si se completó el extremo superior del rango en
 * todas las series planificadas, con técnica conforme, sin dolor y con margen (RIR ≥ 2),
 * y sin señales de peor recuperación o caída de rendimiento.
 */
export function progressionSuggestion(last: ExerciseLog, previous: ExerciseLog | null, ctx: SuggestionContext): Suggestion {
  const no = (r: string): Suggestion => ({ suggest: false, newKg: null, reasons: [r] });
  if (ctx.repeatWeek) return no('Semana de repetición: se mantiene la carga.');
  if (last.skipped) return no('El ejercicio se omitió.');
  if (last.pain > 0) return no('Registraste dolor o molestia: no se recomienda subir carga.');
  if (ctx.dayRecoveryFeel === 'mala') return no('Marcaste recuperación mala ese día.');
  if (ctx.sleepHours != null && ctx.sleepHours < 6) return no('Dormiste menos de 6 h: mejor mantener.');
  const ds = doneSets(last);
  if (ds.length < last.plannedSets) return no('No se completaron todas las series planificadas.');
  if (ds.some((s) => s.kg == null)) return no('Falta la carga en alguna serie.');
  const kgs = new Set(ds.map((s) => s.kg));
  if (kgs.size !== 1) return no('Usaste cargas distintas entre series: repetí la carga más baja hasta completarla.');
  if (ds.some((s) => (s.reps ?? 0) < last.repMax)) return no(`Todavía no completaste ${last.repMax} repeticiones en todas las series.`);
  if (ds.some((s) => s.rir == null)) return no('Falta registrar repeticiones en reserva (RIR) para saber si hubo margen.');
  if (ds.some((s) => (s.rir ?? 0) < 2)) return no('Quedó poco margen (RIR menor a 2).');
  if (last.techniqueOk !== true) return no('Confirmá que la técnica fue buena para recibir una sugerencia.');
  if (previous) {
    const pd = doneSets(previous);
    const pKg = Math.max(...pd.map((s) => s.kg ?? 0));
    const lKg = ds[0].kg ?? 0;
    // Comparar serie a serie sobre las series en común (reducir series no es "caída").
    const k = Math.min(pd.length, ds.length);
    const pReps = pd.slice(0, k).reduce((a, s) => a + (s.reps ?? 0), 0);
    const lReps = ds.slice(0, k).reduce((a, s) => a + (s.reps ?? 0), 0);
    if (lKg === pKg && lReps < pReps) return no('El rendimiento bajó respecto de la vez anterior.');
  }
  const kg = ds[0].kg as number;
  const newKg = Math.round((kg + ctx.incrementKg) * 100) / 100;
  return { suggest: true, newKg, reasons: [`Completaste ${ds.length}×${last.repMax} con ${fmtKg(kg)} kg, buena técnica, sin dolor y con margen.`] };
}

/** Estado sugerido al terminar: completada si cada ejercicio está completo u omitido con motivo. */
export function finishStatus(s: WorkoutSession): 'completada' | 'incompleta' {
  const ok = s.exercises.every((e) => e.skipped || doneSets(e).length >= e.plannedSets);
  return ok ? 'completada' : 'incompleta';
}

export function effectiveSetsCount(s: WorkoutSession) {
  return s.exercises.reduce((a, e) => a + (e.skipped ? 0 : doneSets(e).length), 0);
}
