import { blockForWeek, isDeloadWeek } from '../data/program';
import { DEFAULT_TEMPLATES } from '../data/templates';
import { diffDays, weekday } from './dates';
import { kvGet } from './db';
import { uid } from './format';
import type { DayTemplate, ExerciseLog, ExerciseTemplate, Prescription, SetLog, WorkoutSession } from './types';

/** Plantillas editadas por el usuario; si son de la versión anterior del programa, se usan las nuevas. */
export async function getTemplates(): Promise<DayTemplate[]> {
  const stored = await kvGet<DayTemplate[]>('templates');
  const current = stored?.every((d) => d.exercises.every((e) => typeof e.video === 'string' && typeof e.muscle === 'string'));
  return stored && current ? stored : DEFAULT_TEMPLATES;
}

export function templateForDate(templates: DayTemplate[], date: string) {
  return templates.find((t) => t.weekday === weekday(date)) ?? null;
}

/** Semana de programa (1 = primera) a partir de la fecha de inicio. */
export function programWeek(start: string | null | undefined, date: string) {
  if (!start) return 1;
  return Math.max(1, Math.floor(diffDays(start, date) / 7) + 1);
}

/** Series de un ejercicio según la semana del programa (bloque, prioridad, descarga, adaptación). */
export function plannedSetsFor(t: ExerciseTemplate, week: number, opts: { adaptation?: boolean; reduced?: boolean } = {}) {
  const block = blockForWeek(week);
  let n = t.sets + block.setsDelta + (t.priority ? block.priorityExtra : 0);
  n = Math.max(2, n); // nunca menos de 2 series efectivas
  if (opts.adaptation) n = 2;
  if (isDeloadWeek(week)) n = Math.max(1, Math.ceil(t.sets / 2));
  if (opts.reduced) n -= 1;
  return Math.max(1, Math.min(n, 5));
}

const emptySet = (): SetLog => ({ kg: null, reps: null, rir: null, done: false });

export interface SessionOpts { week: number; adaptation?: boolean; reducedSets?: boolean; history?: WorkoutSession[]; dayContext?: DayContext }

/** Crea una sesión con lo indicado por el programa para cada ejercicio (series, reps, kg, RIR). */
export function newSession(t: DayTemplate, date: string, opts: SessionOpts): WorkoutSession {
  const now = Date.now();
  const block = blockForWeek(opts.week);
  return {
    id: uid(), date, templateId: t.id, templateName: t.name, status: 'en-curso',
    adaptation: !!opts.adaptation || opts.week === 1, reducedSets: !!opts.reducedSets, preCheck: { knee: null, breathing: null },
    week: opts.week, blockName: block.name, deload: isDeloadWeek(opts.week),
    exercises: t.exercises.map((e) => {
      const n = plannedSetsFor(e, opts.week, { adaptation: opts.adaptation, reduced: opts.reducedSets });
      const hist = opts.history ? exerciseHistory(opts.history, e.id, e.name) : [];
      const target = prescribe(e, hist.map((h) => h.ex), { week: opts.week, sets: n, day: opts.dayContext });
      return {
        exerciseId: e.id, name: e.name, plannedSets: n, repMin: e.repMin, repMax: e.repMax,
        warmups: [], sets: Array.from({ length: n }, emptySet), pain: 0, techniqueOk: null, skipped: null, notes: '', target,
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

export interface DayContext { recoveryFeel?: 'buena' | 'normal' | 'mala'; sleepHours?: number | null; pain?: number }

const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const topKg = (e: ExerciseLog) => Math.max(...doneSets(e).map((s) => s.kg ?? 0));

/**
 * Indicación para hoy, calculada con tu historial (más reciente primero). Doble progresión:
 * - Primera vez: calibración (elegís un peso que te deje {rir} reps en reserva).
 * - Si completaste todas las series en el tope del rango, sin dolor y con margen: +incremento mínimo.
 * - Si no: mismo peso, buscando 1 repetición más por serie.
 * - Con dolor o mala recuperación: no se sube; con dolor fuerte se baja un 10 %.
 * - Semana de descarga: -10 % y RIR 4.
 */
export function prescribe(t: ExerciseTemplate, history: ExerciseLog[], ctx: { week: number; sets: number; day?: DayContext }): Prescription {
  const block = blockForWeek(ctx.week);
  const deload = isDeloadWeek(ctx.week);
  const rir = deload ? 4 : ctx.week <= 1 ? 3 : block.rir;
  const base = { sets: ctx.sets, repMin: t.repMin, repMax: t.repMax, rir, restSec: t.restSec[0] };
  const last = history.find((h) => !h.skipped && doneSets(h).some((s) => s.kg != null));
  if (!last) {
    return { ...base, reps: t.repMax, kg: null, kind: 'calibracion',
      note: `Primera vez: elegí un peso con el que llegues a ${t.repMax} repeticiones dejando ${rir} en reserva. Anotalo: desde la próxima sesión la app te indica el peso.` };
  }
  const kg = topKg(last);
  const ds = doneSets(last).filter((s) => s.kg === kg);
  const lastMinReps = Math.min(...ds.map((s) => s.reps ?? 0));
  if (deload) return { ...base, reps: t.repMin, kg: roundTo(kg * 0.9, t.incrementKg), kind: 'descarga', note: 'Semana de descarga: menos series y un 10 % menos de carga. Terminá con energía.' };
  if (last.pain >= 4) return { ...base, reps: t.repMin, kg: roundTo(kg * 0.9, t.incrementKg), kind: 'bajar', note: `La última vez marcaste molestia ${last.pain}/10: bajamos un 10 %. Si molesta otra vez, omitilo y anotá el motivo.` };
  const holdReason = last.pain > 0 ? 'registraste molestia la última vez'
    : ctx.day?.recoveryFeel === 'mala' ? 'marcaste recuperación mala'
      : ctx.day?.sleepHours != null && ctx.day.sleepHours < 6 ? 'dormiste menos de 6 h'
        : (ctx.day?.pain ?? 0) >= 2 ? 'marcaste dolor hoy' : null;
  const allTop = doneSets(last).length >= last.plannedSets && ds.length === doneSets(last).length && ds.every((s) => (s.reps ?? 0) >= t.repMax);
  const margin = ds.every((s) => s.rir == null || s.rir >= 1);
  if (allTop && margin && last.techniqueOk !== false && !holdReason) {
    const newKg = Math.round((kg + t.incrementKg) * 100) / 100;
    return { ...base, reps: t.repMin, kg: newKg, kind: 'subir', note: `Completaste ${ds.length}×${t.repMax} con ${fmtKg(kg)} kg: hoy subís a ${fmtKg(newKg)} kg y apuntás a ${t.repMin} repeticiones.` };
  }
  const reps = Math.min(t.repMax, Math.max(t.repMin, lastMinReps + 1));
  if (holdReason) return { ...base, reps: Math.max(t.repMin, Math.min(t.repMax, lastMinReps)), kg, kind: 'repetir', note: `Mismo peso y mismas repeticiones: ${holdReason}.` };
  return { ...base, reps, kg, kind: 'mas-reps', note: `Mismo peso (${fmtKg(kg)} kg): buscá ${reps} repeticiones en cada serie. Cuando completes ${t.repMax} en todas, sube.` };
}

/** Estado sugerido al terminar: completada si cada ejercicio está completo u omitido con motivo. */
export function finishStatus(s: WorkoutSession): 'completada' | 'incompleta' {
  const ok = s.exercises.every((e) => e.skipped || doneSets(e).length >= e.plannedSets);
  return ok ? 'completada' : 'incompleta';
}

export function effectiveSetsCount(s: WorkoutSession) {
  return s.exercises.reduce((a, e) => a + (e.skipped ? 0 : doneSets(e).length), 0);
}
