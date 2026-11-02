import { describe, expect, it } from 'vitest';
import { activityFactor, energyPlan, mifflin, projection, waistToHeight } from '../src/lib/energy';

describe('energía', () => {
  it('Mifflin-St Jeor: hombre 110 kg, 186 cm, 25 años = 2142,5 kcal', () => {
    expect(mifflin({ sex: 'masculino', weightKg: 110, heightCm: 186, age: 25 })).toBeCloseTo(2142.5);
  });
  it('factor de actividad crece con pasos y días de pesas', () => {
    expect(activityFactor(9500, 5)).toBe(1.52);
    expect(activityFactor(15000, 5)).toBeGreaterThan(activityFactor(9500, 5));
  });
  it('plan: déficit moderado, proteína 1,6–1,8 g/kg, macros que cierran con las calorías', () => {
    const p = energyPlan({ sex: 'masculino', weightKg: 110, heightCm: 186, age: 25, stepsAvg: 9500, trainingDays: 5 });
    expect(p.tdee).toBeGreaterThan(3100);
    expect(p.tdee).toBeLessThan(3400);
    expect(p.target).toBeGreaterThanOrEqual(2350);
    expect(p.target).toBeLessThanOrEqual(2550);
    expect(p.protein).toBe(180);
    const kcal = p.protein * 4 + p.carbs * 4 + p.fat * 9;
    expect(Math.abs(kcal - p.target)).toBeLessThan(25);
  });
  it('proyección: tres escenarios ordenados', () => {
    const r = projection(110, 90);
    expect(r.favorable).toBeLessThan(r.realista);
    expect(r.realista).toBeLessThan(r.conservador);
    expect(r.conservador).toBeLessThan(110);
  });
  it('cintura/altura', () => {
    expect(waistToHeight(120, 186)).toBe(0.65);
  });
});
