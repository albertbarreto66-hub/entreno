import { findOption, MENU } from '../data/menu';
import { weekday } from './dates';
import { put } from './db';
import { uid } from './format';
import { mealVariant, menuDayForWeekday } from './nutrition';
import type { MealLog, MealSlot } from './types';

export function planMealFor(date: string, slot: Exclude<MealSlot, 'extra'>, noEgg: boolean) {
  const day = menuDayForWeekday(weekday(date));
  const meal = MENU.find((d) => d.day === day)!.meals[slot];
  const v = mealVariant(meal, noEgg);
  return { day, meal, variant: v, usedNoEgg: noEgg && !!meal.noEgg };
}

export function newMealLog(date: string, slot: MealSlot, partial: Partial<MealLog> = {}): MealLog {
  const now = Date.now();
  return { id: uid(), date, slot, title: '', items: [], createdAt: now, updatedAt: now, ...partial };
}

/** "Comí esto": registra la comida del plan (o la opción elegida) tal cual. */
export async function logPlanMeal(date: string, slot: Exclude<MealSlot, 'extra'>, noEgg: boolean, menuDay?: number, optionId?: string) {
  const day = menuDay ?? menuDayForWeekday(weekday(date));
  const meal = findOption(slot, optionId) ?? MENU.find((d) => d.day === day)!.meals[slot];
  const v = mealVariant(meal, noEgg);
  const log = newMealLog(date, slot, {
    title: v.title, items: v.items.map((i) => ({ ...i })),
    fromPlan: { day, slot, noEgg: noEgg && !!meal.noEgg, optionId: meal.id },
  });
  await put('meals', log);
  return log;
}
