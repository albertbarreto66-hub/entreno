import { MENU } from '../data/menu';
import { getSchedule, patchSettings } from './app';
import { addDays, weekday } from './dates';
import { kvGet, kvSet } from './db';
import { setGoal } from './goals';
import { menuDayTotals } from './nutrition';
import { PROGRAM_SCHEDULE } from '../data/schedule';

export { PROGRAM_SCHEDULE };

/** Promedio de calorías y proteína de la semana sugerida del menú. */
export function menuAverages() {
  const ts = MENU.map((d) => menuDayTotals(d.day));
  const avg = (k: 'kcal' | 'protein') => ts.reduce((a, t) => a + t[k], 0) / ts.length;
  return { kcal: Math.round(avg('kcal') / 50) * 50, protein: Math.round(avg('protein') / 5) * 5 };
}

/** Lunes de inicio: hoy si es lunes; si no, el próximo lunes. */
export function nextMonday(today: string) {
  const wd = weekday(today);
  return wd === 1 ? today : addDays(today, ((8 - wd) % 7) || 7);
}

export interface ApplyOptions { today: string; start: string; stepsStart: number }

/**
 * Aplica el programa: fecha de inicio (semana 1), metas (desde hoy, sin tocar el historial),
 * horario propuesto. No borra registros.
 */
export async function applyProgram({ today, start, stepsStart }: ApplyOptions) {
  const m = menuAverages();
  await kvSet('programStart', start);
  await setGoal('kcal', m.kcal, today);
  await setGoal('protein', m.protein, today);
  await setGoal('steps', stepsStart, today);
  const prev = await getSchedule();
  await kvSet('schedulePrevious', prev, true);
  await kvSet('schedule', PROGRAM_SCHEDULE);
  await patchSettings({ adaptationWeeks: 1, repeatWeek: false, onboarded: true });
  await kvSet('programApplied', { at: Date.now(), start, version: 2 }, true);
}

export async function programApplied() {
  return kvGet<{ at: number; start: string; version: number }>('programApplied');
}
