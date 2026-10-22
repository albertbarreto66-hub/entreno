import { describe, expect, it } from 'vitest';
import { classifySource, summarizeSleep, SLEEP } from '../src/health/classify';
import { startOfDayMs, endOfDayMs } from '../src/lib/dates';
import { goalFor } from '../src/lib/goals';
import { overlapFraction, resolveDaySteps, reviewStepWeek, stepGoalMet } from '../src/lib/steps';
import type { GoalEntry, HealthRecord } from '../src/lib/types';

const g = (kind: GoalEntry['kind'], value: number | null, from: string, createdAt = 1): GoalEntry => ({ id: from + value + createdAt, kind, value, from, createdAt });

describe('historial de metas', () => {
  it('cambiar la meta no altera días anteriores', () => {
    const goals = [g('steps', 15000, '2000-01-01'), g('steps', 15500, '2026-11-02')];
    expect(goalFor(goals, 'steps', '2026-10-30')).toBe(15000);
    expect(goalFor(goals, 'steps', '2026-11-02')).toBe(15500);
    expect(goalFor(goals, 'steps', '2026-12-01')).toBe(15500);
  });
  it('la última edición del mismo día gana; meta opcional puede ser null', () => {
    const goals = [g('fluidsMl', 2500, '2026-10-01', 1), g('fluidsMl', null, '2026-10-01', 2)];
    expect(goalFor(goals, 'fluidsMl', '2026-10-05')).toBeNull();
    expect(goalFor([], 'steps', '2026-10-05')).toBeNull();
  });
});

const D = '2026-10-22';
const ds = startOfDayMs(D), de = endOfDayMs(D);
let n = 0;
function rec(p: Partial<HealthRecord>): HealthRecord {
  return { uuid: 'u' + n++, type: 'steps', start: ds + 3600e3, end: ds + 3700e3, date: D, value: 1000, sourceName: 'Connect', sourceId: 'com.garmin.connect.mobile', userEntered: false, kind: 'garmin', importedAt: 0, updatedAt: 0, ...p };
}
const settings = { stepGoalBasis: 'reloj' as const, stepSource: 'garmin' as const, watchSourceId: null };

describe('política de pasos', () => {
  it('no suma Garmin + iPhone: usa la fuente preferida', () => {
    const recs = [rec({ value: 8000 }), rec({ value: 9000, sourceId: 'com.apple.health.X', sourceName: 'iPhone', kind: 'iphone' })];
    const r = resolveDaySteps({ date: D }, recs, ds, de, settings);
    expect(r.value).toBe(8000);
    expect(r.origin).toBe('garmin');
    expect(r.phone).toBe(9000);
    const r2 = resolveDaySteps({ date: D }, recs, ds, de, { ...settings, stepSource: 'iphone' });
    expect(r2.value).toBe(9000);
    expect(r2.countsForGoal).toBe(false); // base "reloj"
  });
  it('excluye muestras ingresadas a mano en Salud y registros manuales para metas del reloj', () => {
    const recs = [rec({ value: 20000, userEntered: true, kind: 'manual' })];
    const r = resolveDaySteps({ date: D, stepsManual: 16000 }, recs, ds, de, settings);
    expect(r.watch).toBeNull();
    expect(r.value).toBe(16000);
    expect(r.origin).toBe('manual');
    expect(stepGoalMet(r, 15000)).toBe(false);
    const r2 = resolveDaySteps({ date: D, stepsManual: 16000 }, recs, ds, de, { ...settings, stepGoalBasis: 'manual-permitido' });
    expect(stepGoalMet(r2, 15000)).toBe(true);
  });
  it('sin datos no es cero', () => {
    const r = resolveDaySteps({ date: D }, [], ds, de, settings);
    expect(r.value).toBeNull();
    expect(stepGoalMet(r, 0)).toBe(false);
  });
  it('prorratea muestras que cruzan la medianoche local', () => {
    expect(overlapFraction(ds - 1800e3, ds + 1800e3, ds, de)).toBeCloseTo(0.5);
    const r = resolveDaySteps({ date: D }, [rec({ start: ds - 1800e3, end: ds + 1800e3, value: 1000 })], ds, de, settings);
    expect(r.value).toBe(500);
  });
  it('la fuente elegida como reloj tiene prioridad', () => {
    expect(classifySource({ sourceId: 'x.y', sourceName: 'Mi reloj', userEntered: false }, 'x.y')).toBe('garmin');
    expect(classifySource({ sourceId: 'com.garmin.connect.mobile', sourceName: 'Connect', userEntered: true })).toBe('manual');
    expect(classifySource({ sourceId: 'com.apple.health.ABC', sourceName: 'iPhone de Albert', productType: 'iPhone15,2', userEntered: false })).toBe('iphone');
  });
});

describe('revisión semanal de pasos', () => {
  const day = (i: number, steps: number | null, met: boolean, extra = {}) => ({ date: `2026-10-1${i}`, steps, goal: 15000, met, ...extra });
  it('sugiere +500 solo con cumplimiento, sin dolor y buena recuperación', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => day(i, 16000, i < 6, { sleepHours: 7.5 }));
    const r = reviewStepWeek({ days, currentGoal: 15000 });
    expect(r.canIncrease).toBe(true);
    expect(r.suggested).toBe(15500);
  });
  it('no sugiere con dolor, poca adherencia o tope de 20.000', () => {
    const ok = [0, 1, 2, 3, 4, 5, 6].map((i) => day(i, 16000, true));
    expect(reviewStepWeek({ days: ok.map((d, i) => (i === 2 ? { ...d, pain: 2 } : d)), currentGoal: 15000 }).canIncrease).toBe(false);
    expect(reviewStepWeek({ days: ok.map((d, i) => (i < 3 ? { ...d, met: false } : d)), currentGoal: 15000 }).canIncrease).toBe(false);
    expect(reviewStepWeek({ days: ok, currentGoal: 20000 }).canIncrease).toBe(false);
    expect(reviewStepWeek({ days: ok.map((d) => ({ ...d, recoveryFeel: 'mala' })), currentGoal: 15000 }).canIncrease).toBe(false);
  });
});

describe('sueño importado', () => {
  it('une intervalos superpuestos, usa una sola fuente y separa "en cama"', () => {
    const base = { type: 'sleep' as const, date: D };
    const h = 3600e3;
    const recs = [
      rec({ ...base, start: ds, end: ds + 7 * h, value: SLEEP.inBed }),
      rec({ ...base, start: ds, end: ds + 3 * h, value: SLEEP.asleepCore }),
      rec({ ...base, start: ds + 2 * h, end: ds + 4 * h, value: SLEEP.asleepDeep }),
      rec({ ...base, start: ds + 5 * h, end: ds + 6 * h, value: SLEEP.asleepREM }),
      rec({ ...base, start: ds, end: ds + 9 * h, value: SLEEP.asleepUnspecified, sourceId: 'iphone', kind: 'iphone' }),
    ];
    const s = summarizeSleep(recs)!;
    expect(s.kind).toBe('garmin');
    expect(s.asleepH).toBeCloseTo(5);
    expect(s.inBedH).toBeCloseTo(7);
  });
});
