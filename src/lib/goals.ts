import { all, put } from './db';
import { uid } from './format';
import type { GoalEntry, GoalKind } from './types';

/**
 * Las metas se guardan como historial: cada cambio rige "desde" una fecha.
 * La meta de un día es la última entrada con from <= ese día, así cambiar la
 * meta actual no altera los días anteriores.
 */
export function goalFor(entries: GoalEntry[], kind: GoalKind, date: string): number | null {
  let best: GoalEntry | null = null;
  for (const e of entries) {
    if (e.kind !== kind || e.from > date) continue;
    if (!best || e.from > best.from || (e.from === best.from && e.createdAt > best.createdAt)) best = e;
  }
  return best ? best.value : null;
}

export async function setGoal(kind: GoalKind, value: number | null, from: string) {
  const e: GoalEntry = { id: uid(), kind, value, from, createdAt: Date.now() };
  await put('goals', e);
  return e;
}

export async function allGoals() { return all('goals'); }
