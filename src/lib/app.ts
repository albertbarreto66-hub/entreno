import { DEFAULT_GOALS, DEFAULT_PROFILE, DEFAULT_SCHEDULE, DEFAULT_SETTINGS } from '../data/profile';
import { todayKey } from './dates';
import { all, kvGet, kvSet, put } from './db';
import { uid } from './format';
import type { Profile, ScheduleItem, Settings } from './types';

/** Crea los valores iniciales la primera vez (no pisa nada existente). */
export async function ensureInitialized() {
  if (!(await kvGet('profile'))) await kvSet<Profile>('profile', DEFAULT_PROFILE, true);
  if (!(await kvGet('schedule'))) await kvSet<ScheduleItem[]>('schedule', DEFAULT_SCHEDULE, true);
  if (!(await kvGet('settings'))) await kvSet<Settings>('settings', DEFAULT_SETTINGS, true);
  if (!(await kvGet('programStart'))) await kvSet('programStart', todayKey(), true);
  const goals = await all('goals');
  if (!goals.length) {
    const from = '2000-01-01';
    const now = Date.now();
    for (const [kind, value] of Object.entries(DEFAULT_GOALS)) {
      await put('goals', { id: uid(), kind: kind as 'steps', value, from, createdAt: now }, true);
    }
  }
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await kvGet<Settings>('settings')) ?? {}) };
}
export async function patchSettings(p: Partial<Settings>) {
  const cur = await getSettings();
  await kvSet('settings', { ...cur, ...p });
}
export async function getProfile(): Promise<Profile> {
  return { ...DEFAULT_PROFILE, ...((await kvGet<Profile>('profile')) ?? {}) };
}
export async function getSchedule(): Promise<ScheduleItem[]> {
  return (await kvGet<ScheduleItem[]>('schedule')) ?? DEFAULT_SCHEDULE;
}
