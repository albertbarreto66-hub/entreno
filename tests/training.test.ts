import { describe, expect, it } from 'vitest';
import { BLOCKS, blockForWeek, isDeloadWeek } from '../src/data/program';
import { DEFAULT_TEMPLATES, videoUrl } from '../src/data/templates';
import { effectiveSetsCount, exerciseHistory, finishStatus, newSession, plannedSetsFor, prescribe, programWeek } from '../src/lib/training';
import type { ExerciseLog } from '../src/lib/types';

const lunes = DEFAULT_TEMPLATES[0];
const press = lunes.exercises[0]; // 3 × 6–10, principal, +2,5 kg
function ex(sets: [number | null, number | null, number | null, boolean][], extra: Partial<ExerciseLog> = {}): ExerciseLog {
  return { exerciseId: press.id, name: press.name, plannedSets: sets.length, repMin: 6, repMax: 10, warmups: [], pain: 0, techniqueOk: null, skipped: null,
    sets: sets.map(([kg, reps, rir, done]) => ({ kg, reps, rir, done })), ...extra };
}

describe('plantillas y programa', () => {
  it('cinco sesiones de 5 a 7 ejercicios, cada uno con músculo, video de búsqueda y descanso según tipo', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(5);
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.exercises.length).toBeGreaterThanOrEqual(5);
      expect(t.exercises.length).toBeLessThanOrEqual(7);
      for (const e of t.exercises) {
        expect(e.restSec).toEqual(e.main ? [120, 150] : [60, 90]);
        expect(e.muscle.length).toBeGreaterThan(3);
        expect(videoUrl(e.video)).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
      }
    }
  });
  it('torso tres días y pierna dos (martes y jueves); cada sesión entra en ~60 minutos', () => {
    const LEG = /prensa|sentadilla|femoral|hip thrust|abducci|gemelo|rumano|cuádriceps/i;
    for (const t of DEFAULT_TEMPLATES) {
      const legs = t.exercises.filter((e) => LEG.test(e.name)).length;
      if ([2, 4].includes(t.weekday)) expect(legs).toBeGreaterThanOrEqual(4);
      else expect(legs, t.name).toBe(0);
      // Tiempo estimado en el bloque de más volumen: series × (descanso + 45 s) + 8 min de calentamiento
      const minutes = t.exercises.reduce((a, e) => a + plannedSetsFor(e, 10) * (e.restSec[0] + 45), 0) / 60 + 8;
      expect(minutes, t.name).toBeLessThanOrEqual(66);
    }
  });
  it('24 semanas en 6 bloques con descargas en las semanas 12 y 24', () => {
    expect(BLOCKS).toHaveLength(6);
    expect(blockForWeek(1).n).toBe(1);
    expect(blockForWeek(9).n).toBe(3);
    expect(blockForWeek(30).n).toBe(6);
    expect(isDeloadWeek(12)).toBe(true);
    expect(isDeloadWeek(24)).toBe(true);
    expect(isDeloadWeek(11)).toBe(false);
  });
  it('series según bloque: semana 1 = 2, base desde la 5, +1 en prioritarios en bloque 3, mitad en descarga', () => {
    expect(plannedSetsFor(press, 1)).toBe(2);
    expect(plannedSetsFor(press, 3)).toBe(2); // bloque 1: base − 1
    expect(plannedSetsFor(press, 6)).toBe(3);
    expect(plannedSetsFor(press, 10)).toBe(4); // prioritario +1
    expect(plannedSetsFor(press, 12)).toBe(2); // descarga
    const noPrio = lunes.exercises.find((e) => !e.priority)!;
    expect(plannedSetsFor(noPrio, 10)).toBe(noPrio.sets);
    expect(plannedSetsFor(press, 6, { reduced: true })).toBe(2);
  });
});

describe('prescripción (doble progresión)', () => {
  const ctx = { week: 6, sets: 3 };
  it('primera vez: calibración, sin kilos inventados', () => {
    const r = prescribe(press, [], ctx);
    expect(r.kind).toBe('calibracion');
    expect(r.kg).toBeNull();
    expect(r.reps).toBe(10);
  });
  it('tope del rango en todas las series, sin dolor y con margen: sube el incremento mínimo y vuelve al mínimo de reps', () => {
    const r = prescribe(press, [ex([[40, 10, 2, true], [40, 10, 2, true], [40, 10, 1, true]])], ctx);
    expect(r).toMatchObject({ kind: 'subir', kg: 42.5, reps: 6, sets: 3, rir: 2 });
  });
  it('si no llegó al tope: mismo peso y +1 repetición', () => {
    const r = prescribe(press, [ex([[40, 8, 2, true], [40, 7, 2, true], [40, 7, 2, true]])], ctx);
    expect(r).toMatchObject({ kind: 'mas-reps', kg: 40, reps: 8 });
  });
  it('sin margen (RIR 0), técnica con dudas, molestia, mala recuperación o poco sueño: no sube', () => {
    const top = ex([[40, 10, 2, true], [40, 10, 2, true], [40, 10, 2, true]]);
    expect(prescribe(press, [ex([[40, 10, 0, true], [40, 10, 2, true], [40, 10, 2, true]])], ctx).kind).not.toBe('subir');
    expect(prescribe(press, [{ ...top, techniqueOk: false }], ctx).kind).not.toBe('subir');
    expect(prescribe(press, [{ ...top, pain: 2 }], ctx)).toMatchObject({ kind: 'repetir', kg: 40 });
    expect(prescribe(press, [top], { ...ctx, day: { recoveryFeel: 'mala' } }).kind).toBe('repetir');
    expect(prescribe(press, [top], { ...ctx, day: { sleepHours: 5 } }).kind).toBe('repetir');
  });
  it('molestia fuerte: baja un 10 % redondeado al incremento', () => {
    expect(prescribe(press, [ex([[40, 8, 2, true]], { pain: 5 })], ctx)).toMatchObject({ kind: 'bajar', kg: 35 });
  });
  it('semana de descarga: −10 % y RIR 4', () => {
    expect(prescribe(press, [ex([[50, 8, 2, true]])], { week: 12, sets: 2 })).toMatchObject({ kind: 'descarga', kg: 45, rir: 4 });
  });
  it('semana 1: RIR 3', () => {
    expect(prescribe(press, [], { week: 1, sets: 2 }).rir).toBe(3);
  });
});

describe('sesión', () => {
  it('trae lo indicado por el programa para cada ejercicio, con kilos solo si hay historial', () => {
    const a = newSession(lunes, '2026-11-02', { week: 1 });
    expect(a.exercises.every((e) => e.target?.kind === 'calibracion' && e.target.kg == null)).toBe(true);
    a.status = 'completada';
    a.exercises[0].sets = [{ kg: 40, reps: 10, rir: 3, done: true }, { kg: 40, reps: 10, rir: 3, done: true }];
    const b = newSession(lunes, '2026-11-09', { week: 2, history: [a] });
    expect(b.exercises[0].target).toMatchObject({ kind: 'subir', kg: 42.5 });
    expect(b.exercises[1].target?.kind).toBe('calibracion');
    expect(b.exercises.every((e) => e.sets.every((s) => s.kg == null))).toBe(true); // las series se completan al marcar "Hecha"
  });
  it('los calentamientos no cuentan como series efectivas', () => {
    const s = newSession(lunes, '2026-11-02', { week: 1 });
    s.exercises[0].warmups = [{ kg: 20, reps: 10 }, { kg: 30, reps: 5 }];
    s.exercises[0].sets[0] = { kg: 40, reps: 8, rir: 2, done: true };
    expect(effectiveSetsCount(s)).toBe(1);
  });
  it('estado al terminar: completada solo si todo está hecho u omitido', () => {
    const s = newSession(lunes, '2026-11-02', { week: 1 });
    expect(finishStatus(s)).toBe('incompleta');
    for (const e of s.exercises) e.sets.forEach((x) => Object.assign(x, { kg: 10, reps: 10, rir: 2, done: true }));
    s.exercises[2].sets.forEach((x) => (x.done = false));
    s.exercises[2].skipped = { reason: 'Dolor o molestia' };
    expect(finishStatus(s)).toBe('completada');
  });
  it('semana del programa', () => {
    expect(programWeek('2026-11-02', '2026-11-08')).toBe(1);
    expect(programWeek('2026-11-02', '2026-11-09')).toBe(2);
  });
  it('historial: busca la sesión anterior del mismo ejercicio y excluye omitidas', () => {
    const a = newSession(lunes, '2026-10-12', { week: 3 });
    a.status = 'completada';
    a.exercises[0].sets[0] = { kg: 40, reps: 8, rir: 2, done: true };
    const b = { ...newSession(lunes, '2026-10-14', { week: 3 }), status: 'omitida' as const };
    const c = newSession(lunes, '2026-10-19', { week: 4 });
    const h = exerciseHistory([a, b, c], lunes.exercises[0].id, lunes.exercises[0].name, c.id);
    expect(h).toHaveLength(1);
    expect(h[0].session.date).toBe('2026-10-12');
  });
});
