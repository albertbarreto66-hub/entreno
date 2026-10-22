import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from '../src/data/templates';
import { effectiveSetsCount, exerciseHistory, finishStatus, newSession, plannedSetsFor, progressionSuggestion, programWeek } from '../src/lib/training';
import type { ExerciseLog } from '../src/lib/types';

const lunes = DEFAULT_TEMPLATES[0];
function ex(sets: [number | null, number | null, number | null, boolean][], extra: Partial<ExerciseLog> = {}): ExerciseLog {
  return { exerciseId: 'a', name: 'Press', plannedSets: sets.length, repMin: 6, repMax: 8, warmups: [], pain: 0, techniqueOk: true, skipped: null,
    sets: sets.map(([kg, reps, rir, done]) => ({ kg, reps, rir, done })), ...extra };
}
const ctx = { repeatWeek: false, incrementKg: 2.5 };

describe('plantillas', () => {
  it('cinco sesiones con 5 a 7 ejercicios y descansos según tipo', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(5);
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.exercises.length).toBeGreaterThanOrEqual(5);
      expect(t.exercises.length).toBeLessThanOrEqual(7);
      for (const e of t.exercises) expect(e.restSec).toEqual(e.main ? [120, 180] : [60, 90]);
    }
  });
});

describe('distribución semanal', () => {
  it('piernas solo los viernes; el resto de la semana es torso, brazos y core', () => {
    const LEG = /prensa|sentadilla|femoral|hip thrust|abducci|gemelo|rumano|puente/i;
    for (const t of DEFAULT_TEMPLATES) {
      const legs = t.exercises.filter((e) => LEG.test(e.name));
      if (t.weekday === 5) expect(legs.length).toBe(t.exercises.length);
      else expect(legs.map((e) => e.name), t.name).toEqual([]);
    }
  });
});

describe('sesión', () => {
  it('no precarga pesos y respeta adaptación / reducción', () => {
    const s = newSession(lunes, '2026-10-19', { adaptation: true, reducedSets: false });
    expect(s.exercises.every((e) => e.sets.every((x) => x.kg == null && x.reps == null))).toBe(true);
    expect(s.exercises.every((e) => e.plannedSets <= 2)).toBe(true);
    expect(plannedSetsFor(lunes.exercises[0], false, true)).toBe(2);
    expect(plannedSetsFor(lunes.exercises[0], true, true)).toBe(1);
  });
  it('los calentamientos no cuentan como series efectivas', () => {
    const s = newSession(lunes, '2026-10-19', { adaptation: true, reducedSets: false });
    s.exercises[0].warmups = [{ kg: 20, reps: 10 }, { kg: 30, reps: 5 }];
    s.exercises[0].sets[0] = { kg: 40, reps: 8, rir: 2, done: true };
    expect(effectiveSetsCount(s)).toBe(1);
  });
  it('estado al terminar: completada solo si todo está hecho u omitido', () => {
    const s = newSession(lunes, '2026-10-19', { adaptation: true, reducedSets: false });
    expect(finishStatus(s)).toBe('incompleta');
    for (const e of s.exercises) e.sets.forEach((x) => Object.assign(x, { kg: 10, reps: 10, rir: 2, done: true }));
    s.exercises[2].sets.forEach((x) => (x.done = false));
    s.exercises[2].skipped = { reason: 'Dolor o molestia' };
    expect(finishStatus(s)).toBe('completada');
  });
  it('semana del programa', () => {
    expect(programWeek('2026-10-19', '2026-10-25')).toBe(1);
    expect(programWeek('2026-10-19', '2026-10-26')).toBe(2);
  });
  it('historial: busca la sesión anterior del mismo ejercicio y excluye omitidas', () => {
    const a = newSession(lunes, '2026-10-12', { adaptation: false, reducedSets: false });
    a.status = 'completada';
    a.exercises[0].sets[0] = { kg: 40, reps: 8, rir: 2, done: true };
    const b = { ...newSession(lunes, '2026-10-14', { adaptation: false, reducedSets: false }), status: 'omitida' as const };
    const c = newSession(lunes, '2026-10-19', { adaptation: false, reducedSets: false });
    const h = exerciseHistory([a, b, c], lunes.exercises[0].id, lunes.exercises[0].name, c.id);
    expect(h).toHaveLength(1);
    expect(h[0].session.date).toBe('2026-10-12');
  });
});

describe('progresión', () => {
  const top = ex([[40, 8, 2, true], [40, 8, 3, true], [40, 8, 2, true]]);
  it('sugiere el mínimo disponible al completar el extremo superior con margen, técnica y sin dolor', () => {
    const r = progressionSuggestion(top, null, ctx);
    expect(r.suggest).toBe(true);
    expect(r.newKg).toBe(42.5);
  });
  it('no sugiere sin el extremo superior, con dolor, sin margen, sin técnica confirmada o en semana repetida', () => {
    expect(progressionSuggestion(ex([[40, 8, 2, true], [40, 7, 2, true], [40, 8, 2, true]]), null, ctx).suggest).toBe(false);
    expect(progressionSuggestion({ ...top, pain: 2 }, null, ctx).suggest).toBe(false);
    expect(progressionSuggestion(ex([[40, 8, 1, true], [40, 8, 2, true], [40, 8, 2, true]]), null, ctx).suggest).toBe(false);
    expect(progressionSuggestion({ ...top, techniqueOk: null }, null, ctx).suggest).toBe(false);
    expect(progressionSuggestion(top, null, { ...ctx, repeatWeek: true }).suggest).toBe(false);
    expect(progressionSuggestion(top, null, { ...ctx, dayRecoveryFeel: 'mala' }).suggest).toBe(false);
    expect(progressionSuggestion(top, null, { ...ctx, sleepHours: 5 }).suggest).toBe(false);
    expect(progressionSuggestion(ex([[40, 8, 2, true], [40, 8, 2, true], [null, null, null, false]]), null, ctx).suggest).toBe(false);
  });
  it('no sugiere si el rendimiento cayó respecto de la vez anterior', () => {
    const prev = ex([[40, 8, 3, true], [40, 8, 3, true], [40, 8, 3, true], [40, 8, 3, true]], { plannedSets: 4 });
    const last = ex([[40, 8, 2, true], [40, 8, 2, true], [40, 8, 2, true]]);
    expect(progressionSuggestion(last, prev, ctx).suggest).toBe(true); // menos series planificadas, mismas reps por serie
    const prev2 = ex([[40, 10, 2, true], [40, 10, 2, true], [40, 10, 2, true]]);
    expect(progressionSuggestion(last, prev2, ctx).suggest).toBe(false);
  });
});
