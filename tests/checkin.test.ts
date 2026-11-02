import { describe, expect, it } from 'vitest';
import { evaluateWeek, strengthTrend } from '../src/lib/checkin';
import { addDays } from '../src/lib/dates';
import { DEFAULT_TEMPLATES } from '../src/data/templates';
import { newSession } from '../src/lib/training';

const today = '2026-11-23'; // lunes, semana 4
// tres semanas de pesajes (lun/mié/vie) con el promedio indicado
function weights(avgs: number[]) {
  const pts = [];
  const mondays = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'].slice(-avgs.length);
  for (let w = 0; w < avgs.length; w++) for (const d of [0, 2, 4]) if (addDays(mondays[w], d) <= today) pts.push({ date: addDays(mondays[w], d), value: avgs[w] });
  return pts;
}
const base = { today, programWeek: 4, waists: [], adherence: 0.9, trainingsDone: 5, trainingsPlanned: 5, sleepAvg: 7.2, stepsAvg: 11000, strength: { up: 4, down: 0, same: 2 }, checkin: { energy: 4, hunger: 3, recovery: 4 } };

describe('control semanal', () => {
  it('sin 2 semanas de pesajes no evalúa', () => {
    expect(evaluateWeek({ ...base, weights: weights([110]) }).status).toBe('sin-datos');
  });
  it('adherencia baja: no toca calorías', () => {
    const r = evaluateWeek({ ...base, adherence: 0.5, weights: weights([110, 110, 110]) });
    expect(r.status).toBe('adherencia');
    expect(r.kcalDelta).toBe(0);
  });
  it('estancado 2 semanas con buena adherencia: sugiere −150 kcal (o más pasos)', () => {
    const r = evaluateWeek({ ...base, weights: weights([110.05, 110, 109.9, 109.85]) });
    expect(r.status).toBe('lento');
    expect(r.kcalDelta).toBe(-150);
    expect(r.actions.join(' ')).toMatch(/pasos/);
  });
  it('estancado pero la cintura bajó: no cambia nada', () => {
    const r = evaluateWeek({ ...base, weights: weights([110.05, 110, 109.9, 109.85]), waists: [{ date: '2026-11-09', value: 120 }, { date: '2026-11-23', value: 118.5 }] });
    expect(r.status).toBe('en-rango');
    expect(r.kcalDelta).toBe(0);
  });
  it('estancado con mala recuperación: no baja calorías y reduce volumen', () => {
    const r = evaluateWeek({ ...base, weights: weights([110.05, 110, 109.9, 109.85]), checkin: { energy: 2, hunger: 3, recovery: 2 } });
    expect(r.kcalDelta).toBe(0);
    expect(r.volume).toBe('reducir');
  });
  it('baja demasiado rápido dos semanas: sugiere +150 kcal; en semanas 1–2 se considera agua', () => {
    const fast = weights([110, 108.5, 107]);
    expect(evaluateWeek({ ...base, weights: fast })).toMatchObject({ status: 'rapido', kcalDelta: 150 });
    expect(evaluateWeek({ ...base, programWeek: 2, weights: fast }).status).toBe('en-rango');
  });
  it('ritmo 0,5–1 %: mantener', () => {
    const r = evaluateWeek({ ...base, weights: weights([110, 109.2, 108.5]) });
    expect(r.status).toBe('en-rango');
    expect(r.rate).toBeGreaterThan(0.5);
  });
});

describe('tendencia de fuerza', () => {
  it('compara el 1RM estimado de la última sesión con la anterior', () => {
    const t = DEFAULT_TEMPLATES[0];
    const mk = (date: string, kg: number, reps: number) => {
      const s = newSession(t, date, { week: 3 });
      s.status = 'completada';
      s.exercises[0].sets = [{ kg, reps, rir: 2, done: true }];
      s.exercises[1].sets = [{ kg: 50, reps: 10, rir: 2, done: true }];
      return s;
    };
    const r = strengthTrend([mk('2026-11-09', 40, 8), mk('2026-11-16', 42.5, 8)], '2026-11-20');
    expect(r).toEqual({ up: 1, down: 0, same: 1 });
  });
});
