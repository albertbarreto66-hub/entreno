/**
 * Estimaciones de energía. Son estimaciones con margen de error (±10–15 %), no mediciones:
 * el ajuste real se hace con el control semanal (peso promedio y cintura).
 */
export interface EnergyInput { sex: 'masculino' | 'femenino'; weightKg: number; heightCm: number; age: number; stepsAvg: number; trainingDays: number }

/** Mifflin-St Jeor (1990): la fórmula validada más usada para estimar el metabolismo basal. */
export function mifflin({ sex, weightKg, heightCm, age }: Pick<EnergyInput, 'sex' | 'weightKg' | 'heightCm' | 'age'>) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'masculino' ? 5 : -161);
}

/** Factor de actividad según pasos diarios y días de pesas (aproximado). */
export function activityFactor(stepsAvg: number, trainingDays: number) {
  let f = stepsAvg < 5000 ? 1.3 : stepsAvg < 7500 ? 1.4 : stepsAvg < 10000 ? 1.47 : stepsAvg < 12500 ? 1.53 : 1.6;
  f += Math.min(trainingDays, 6) * 0.01;
  return Math.round(f * 100) / 100;
}

const r50 = (v: number) => Math.round(v / 50) * 50;
const r5 = (v: number) => Math.round(v / 5) * 5;

export interface EnergyPlan {
  bmr: number;
  factor: number;
  tdee: number;
  tdeeLow: number;
  tdeeHigh: number;
  target: number; // déficit moderado (~25 %)
  deficitPct: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export function energyPlan(i: EnergyInput, deficit = 0.25): EnergyPlan {
  const bmr = mifflin(i);
  const factor = activityFactor(i.stepsAvg, i.trainingDays);
  const tdee = bmr * factor;
  const target = r50(tdee * (1 - deficit));
  const protein = r5(i.weightKg * 1.65); // 1,6–1,8 g/kg del peso actual con más grasa corporal
  const fat = r5(i.weightKg * 0.7); // 0,6–0,8 g/kg
  const carbs = r5((target - protein * 4 - fat * 9) / 4);
  return {
    bmr: Math.round(bmr), factor, tdee: r50(tdee), tdeeLow: r50(tdee * 0.9), tdeeHigh: r50(tdee * 1.1),
    target, deficitPct: Math.round(deficit * 100), protein, fat, carbs, fiber: Math.round((target / 1000) * 14),
  };
}

/** Proyección de peso con tres ritmos (% por semana), sin semanas de descarga. Rangos, no promesas. */
export function projection(weightKg: number, days: number) {
  const weeks = days / 7;
  const at = (pct: number) => Math.round(weightKg * Math.pow(1 - pct / 100, weeks) * 10) / 10;
  return { conservador: at(0.4), realista: at(0.7), favorable: at(1.0) };
}

/** Relación cintura/altura: indicador simple de grasa abdominal (no es un diagnóstico). */
export const waistToHeight = (waistCm: number, heightCm: number) => Math.round((waistCm / heightCm) * 100) / 100;

/** Ritmo necesario para llegar a un peso objetivo y comparación con el ritmo actual (kg/semana). */
export function targetPace(currentKg: number, targetKg: number, weeksLeft: number, actualKgPerWeek: number | null) {
  const toLose = Math.max(0, currentKg - targetKg);
  const needed = weeksLeft > 0 ? toLose / weeksLeft : toLose;
  const neededPct = (needed / currentKg) * 100;
  const status: 'logrado' | 'en-camino' | 'por-debajo' | 'sin-datos' | 'exigente' =
    toLose === 0 ? 'logrado'
      : neededPct > 1.1 ? 'exigente'
        : actualKgPerWeek == null ? 'sin-datos'
          : actualKgPerWeek >= needed * 0.85 ? 'en-camino' : 'por-debajo';
  return { toLose: Math.round(toLose * 10) / 10, needed: Math.round(needed * 100) / 100, neededPct: Math.round(neededPct * 100) / 100, status };
}
