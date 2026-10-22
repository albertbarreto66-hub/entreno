import { describe, expect, it } from 'vitest';
import { FOOD_BY_ID, FOODS } from '../src/data/foods';
import { DINNER_EXCLUDED, MENU, OPTIONS } from '../src/data/menu';
import { mealLogTotals, menuDayTotals, shoppingList, substitutes, sumItems } from '../src/lib/nutrition';
import { trend, weeklyAverages } from '../src/lib/trends';
import type { MealLog } from '../src/lib/types';

describe('catálogo y menú', () => {
  it('todos los alimentos del menú existen y tienen fuente', () => {
    for (const d of MENU) for (const m of Object.values(d.meals)) for (const v of [m, m.noEgg].filter(Boolean)) for (const it of v!.items) {
      expect(FOOD_BY_ID[it.foodId], it.foodId).toBeTruthy();
      expect(it.grams).toBeGreaterThan(0);
    }
    for (const f of FOODS) expect(f.source.length).toBeGreaterThan(10);
  });
  it('sin avena, leche ni maní; lácteos solo como opción; huevo siempre con alternativa', () => {
    expect(FOODS.some((f) => /avena|leche|man[ií]/i.test(f.name))).toBe(false);
    for (const m of Object.values(OPTIONS).flat()) {
      expect(m.items.some((i) => FOOD_BY_ID[i.foodId].dairy)).toBe(false);
      if (m.items.some((i) => FOOD_BY_ID[i.foodId].egg)) {
        expect(m.noEgg).toBeTruthy();
        expect(m.noEgg!.items.some((i) => FOOD_BY_ID[i.foodId].egg)).toBe(false);
      }
    }
    const eggDays = MENU.filter((d) => Object.values(d.meals).some((m) => m.items.some((i) => FOOD_BY_ID[i.foodId].egg)));
    expect(eggDays.length).toBeLessThanOrEqual(2);
  });
  it('los totales diarios (calculados, no escritos a mano) caen en el rango de referencia', () => {
    for (const d of MENU) for (const noEgg of [false, true]) {
      const t = menuDayTotals(d.day, noEgg);
      expect(t.kcal, `${d.name} kcal`).toBeGreaterThanOrEqual(2450);
      expect(t.kcal, `${d.name} kcal`).toBeLessThanOrEqual(2750);
      expect(t.protein, `${d.name} prot`).toBeGreaterThanOrEqual(160);
      expect(t.protein, `${d.name} prot`).toBeLessThanOrEqual(195);
    }
  });
  it('las cenas no tienen carbohidratos principales: solo proteína con ensaladas o verduras', () => {
    expect(OPTIONS.cena.length).toBeGreaterThanOrEqual(6);
    for (const o of OPTIONS.cena) {
      for (const v of [o, o.noEgg].filter(Boolean)) {
        const bad = v!.items.filter((i) => DINNER_EXCLUDED.includes(i.foodId) || ['carbohidrato'].includes(FOOD_BY_ID[i.foodId].group));
        expect(bad, o.id).toEqual([]);
      }
      expect(o.items.some((i) => FOOD_BY_ID[i.foodId].group === 'proteina'), o.id).toBe(true);
      expect(o.items.some((i) => FOOD_BY_ID[i.foodId].group === 'verdura'), o.id).toBe(true);
    }
    for (const d of MENU) expect(DINNER_EXCLUDED.some((id) => d.meals.cena.items.some((i) => i.foodId === id))).toBe(false);
  });
  it('varias opciones por comida, con ids únicos y porciones parecidas para poder intercambiarlas', () => {
    const bands = { desayuno: [520, 620], almuerzo: [860, 960], merienda: [480, 540], cena: [520, 600] } as const;
    const ids = new Set<string>();
    for (const [slot, opts] of Object.entries(OPTIONS) as [keyof typeof bands, typeof OPTIONS.cena][]) {
      expect(opts.length, slot).toBeGreaterThanOrEqual(6);
      for (const o of opts) {
        expect(ids.has(o.id), o.id).toBe(false);
        ids.add(o.id);
        for (const v of [o, o.noEgg].filter(Boolean)) {
          const t = sumItems(v!.items);
          expect(t.kcal, `${o.id} kcal`).toBeGreaterThanOrEqual(bands[slot][0]);
          expect(t.kcal, `${o.id} kcal`).toBeLessThanOrEqual(bands[slot][1]);
        }
      }
    }
    // Cualquier combinación de opciones queda cerca de la referencia diaria
    const minDay = (Object.keys(bands) as (keyof typeof bands)[]).reduce((a, k) => a + Math.min(...OPTIONS[k].map((o) => sumItems(o.items).kcal)), 0);
    const maxDay = (Object.keys(bands) as (keyof typeof bands)[]).reduce((a, k) => a + Math.max(...OPTIONS[k].map((o) => sumItems(o.items).kcal)), 0);
    expect(minDay).toBeGreaterThanOrEqual(2380);
    expect(maxDay).toBeLessThanOrEqual(2750);
  });
  it('cálculo comprobable: 230 g pollo crudo = 276 kcal y 51,75 g proteína', () => {
    const t = sumItems([{ foodId: 'pollo-pechuga-cruda', grams: 230 }]);
    expect(t.kcal).toBeCloseTo(276);
    expect(t.protein).toBeCloseTo(51.75);
  });
  it('texto libre sin datos no se estima', () => {
    const m: MealLog = { id: '1', date: '2026-10-22', slot: 'cena', title: 'x', items: [], freeText: 'empanadas', createdAt: 0, updatedAt: 0 };
    expect(mealLogTotals(m).kcal).toBeNull();
    expect(mealLogTotals({ ...m, manualKcal: 600 }).estimated).toBe('manual');
  });
  it('sustituciones con proteína o calorías comparables y sin lácteos si están desactivados', () => {
    const subs = substitutes({ foodId: 'pollo-pechuga-cruda', grams: 200 }, { dairy: false });
    const carne = subs.find((s) => s.food.id === 'carne-magra-cruda')!;
    expect(Math.abs(carne.grams * 0.23 - 45)).toBeLessThan(2);
    expect(subs.some((s) => s.food.dairy || s.food.egg)).toBe(false);
    const arroz = substitutes({ foodId: 'arroz-crudo', grams: 100 }, { dairy: false }).find((s) => s.food.id === 'papa-cruda')!;
    expect(Math.abs((arroz.grams * 77) / 100 - 365)).toBeLessThan(5);
  });
  it('lista de compras suma la semana', () => {
    const g = shoppingList();
    const pollo = g.proteina.find((x) => x.food.id === 'pollo-pechuga-cruda')!;
    let expected = 0;
    for (const d of MENU) for (const m of Object.values(d.meals)) for (const it of m.items) if (it.foodId === 'pollo-pechuga-cruda') expected += it.grams;
    expect(pollo.grams).toBe(expected);
  });
});

describe('tendencias', () => {
  it('promedio semanal sin inventar días', () => {
    const w = weeklyAverages([{ date: '2026-10-19', value: 110 }, { date: '2026-10-21', value: 109 }, { date: '2026-10-26', value: 108 }]);
    expect(w).toEqual([{ week: '2026-10-19', avg: 109.5, n: 2 }, { week: '2026-10-26', avg: 108, n: 1 }]);
  });
  it('exige dos semanas de datos', () => {
    expect(trend([{ date: '2026-10-19', value: 110 }, { date: '2026-10-22', value: 109 }], 'kg').enough).toBe(false);
    const pts = [['2026-10-05', 110], ['2026-10-07', 110.2], ['2026-10-12', 109.8], ['2026-10-19', 109.9], ['2026-10-21', 110]].map(([date, value]) => ({ date: date as string, value: value as number }));
    const r = trend(pts, 'kg');
    expect(r.enough).toBe(true);
    expect(r.message).toMatch(/revisá constancia/);
    expect(r.message).not.toMatch(/recort/i);
  });
});
