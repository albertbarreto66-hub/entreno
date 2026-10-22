import { describe, expect, it } from 'vitest';
import { addDays, dateKey, diffDays, endOfDayMs, formatLong, startOfDayMs, weekday, weekStart } from '../src/lib/dates';

describe('fechas locales (America/Argentina/Buenos_Aires, UTC-3)', () => {
  it('a las 01:30 UTC todavía es el día anterior en Buenos Aires', () => {
    expect(dateKey(Date.UTC(2026, 9, 23, 1, 30))).toBe('2026-10-22');
    expect(dateKey(Date.UTC(2026, 9, 23, 3, 0))).toBe('2026-10-23');
  });
  it('inicio y fin del día local', () => {
    expect(new Date(startOfDayMs('2026-10-22')).toISOString()).toBe('2026-10-22T03:00:00.000Z');
    expect(endOfDayMs('2026-10-22') - startOfDayMs('2026-10-22')).toBe(86400000);
  });
  it('aritmética de días, semanas que empiezan el lunes, cambio de mes y año', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(weekday('2026-10-22')).toBe(4);
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // domingo → lunes anterior
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(diffDays('2026-10-01', '2026-10-22')).toBe(21);
    expect(formatLong('2026-10-22')).toBe('jueves 22 de octubre');
  });
});
