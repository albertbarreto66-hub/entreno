import { summarizeSleep, type SleepSummary } from '../health/classify';
import { getSettings } from './app';
import { addDays, endOfDayMs, startOfDayMs, weekday } from './dates';
import { all, byDate, byDateRange, getDay } from './db';
import { goalFor } from './goals';
import { resolveDaySteps, stepGoalMet, type DaySteps } from './steps';
import { getTemplates, templateForDate } from './training';
import type { DayLog, DayTemplate, FluidLog, GoalEntry, HealthRecord, MealLog, Settings, WorkoutSession } from './types';

export interface DaySummary {
  date: string;
  day: DayLog;
  meals: MealLog[];
  fluids: FluidLog[];
  fluidTotal: number;
  waterTotal: number;
  sessions: WorkoutSession[];
  template: DayTemplate | null;
  trainingDue: boolean;
  trainingDone: boolean;
  watchWorkouts: HealthRecord[];
  steps: DaySteps;
  stepGoal: number | null;
  stepsMet: boolean;
  fluidGoal: number | null;
  sleep: { hours: number | null; origin: 'manual' | 'importado' | null; imported: SleepSummary | null };
  restingHr: HealthRecord | null;
  hrDaily: HealthRecord[];
  settings: Settings;
}

export function computeDaySummary(args: {
  date: string; day: DayLog; meals: MealLog[]; fluids: FluidLog[]; sessions: WorkoutSession[];
  health: HealthRecord[]; goals: GoalEntry[]; templates: DayTemplate[]; settings: Settings; tz?: string;
}): DaySummary {
  const { date, day, meals, fluids, sessions, health, goals, templates, settings, tz } = args;
  const ds = startOfDayMs(date, tz), de = endOfDayMs(date, tz);
  const steps = resolveDaySteps(day, health, ds, de, settings);
  const stepGoal = goalFor(goals, 'steps', date);
  const template = templateForDate(templates, date);
  const wd = weekday(date);
  const trainingDue = !!template && wd >= 1 && wd <= 5 && !day.recovery;
  const trainingDone = sessions.some((s) => s.status === 'completada') || !!day.manualTrainingDone;
  const importedSleep = summarizeSleep(health.filter((r) => r.date === date), settings.stepSource !== 'iphone');
  const manualSleep = day.sleepHours ?? null;
  const fluidTotal = fluids.reduce((a, f) => a + f.ml, 0);
  return {
    date, day, meals, fluids, fluidTotal,
    waterTotal: fluids.filter((f) => f.kind !== 'otra').reduce((a, f) => a + f.ml, 0),
    sessions, template, trainingDue, trainingDone,
    watchWorkouts: health.filter((r) => r.type === 'workout' && r.date === date),
    steps, stepGoal, stepsMet: stepGoalMet(steps, stepGoal),
    fluidGoal: goalFor(goals, 'fluidsMl', date),
    sleep: {
      hours: manualSleep ?? importedSleep?.asleepH ?? null,
      origin: manualSleep != null ? 'manual' : importedSleep?.asleepH != null ? 'importado' : null,
      imported: importedSleep,
    },
    restingHr: health.find((r) => r.type === 'restingHr' && r.date === date && !r.userEntered) ?? null,
    hrDaily: health.filter((r) => r.type === 'hrDaily' && r.date === date),
    settings,
  };
}

export async function loadDaySummary(date: string): Promise<DaySummary> {
  const [day, meals, fluids, sessions, health, goals, templates, settings] = await Promise.all([
    getDay(date), byDate('meals', date), byDate('fluids', date), byDate('sessions', date),
    byDateRange('health', addDays(date, -1), date), all('goals'), getTemplates(), getSettings(),
  ]);
  meals.sort((a, b) => a.createdAt - b.createdAt);
  fluids.sort((a, b) => a.at - b.at);
  return computeDaySummary({ date, day, meals, fluids, sessions, health, goals, templates, settings });
}

/** Resúmenes de un rango (para gráficos y revisión semanal). */
export async function loadRange(from: string, to: string): Promise<DaySummary[]> {
  const [days, meals, fluids, sessions, health, goals, templates, settings] = await Promise.all([
    all('days'), byDateRange('meals', from, to), byDateRange('fluids', from, to), byDateRange('sessions', from, to),
    byDateRange('health', addDays(from, -1), to), all('goals'), getTemplates(), getSettings(),
  ]);
  const out: DaySummary[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(computeDaySummary({
      date: d, day: days.find((x) => x.date === d) ?? { date: d },
      meals: meals.filter((m) => m.date === d), fluids: fluids.filter((f) => f.date === d), sessions: sessions.filter((s) => s.date === d),
      health: health.filter((h) => h.date === d || h.date === addDays(d, -1)), goals, templates, settings,
    }));
  }
  return out;
}
