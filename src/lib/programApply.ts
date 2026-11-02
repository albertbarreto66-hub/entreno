import { MENU } from '../data/menu';
import { getSchedule, patchSettings } from './app';
import { addDays, weekday } from './dates';
import { kvGet, kvSet } from './db';
import { setGoal } from './goals';
import { menuDayTotals } from './nutrition';
import type { ScheduleItem } from './types';

export const PROGRAM_SCHEDULE: ScheduleItem[] = [
  { id: 'levantarse', time: '08:00', label: 'Levantarse (siempre a la misma hora) + luz natural 10 min', remind: false },
  { id: 'desayuno', time: '08:20', label: 'Desayuno', remind: false },
  { id: 'gimnasio', time: '09:30', label: 'Gimnasio (60 min)', remind: false },
  { id: 'almuerzo', time: '13:00', label: 'Almuerzo + caminata de 10 min', remind: false },
  { id: 'cafeina', time: '16:00', label: 'Último mate o café del día', remind: false },
  { id: 'merienda', time: '17:00', label: 'Merienda', remind: false },
  { id: 'caminata', time: '18:30', label: 'Caminata (30–45 min, ritmo en el que puedas hablar)', remind: false },
  { id: 'cena', time: '21:00', label: 'Cena (sin carbohidratos) + caminata corta', remind: false },
  { id: 'descanso', time: '23:30', label: 'Preparar descanso: luz baja, sin pantallas', remind: false },
  { id: 'acostarse', time: '00:00', label: 'Acostarse (meta; ir adelantando 30 min por semana)', remind: false },
];

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
