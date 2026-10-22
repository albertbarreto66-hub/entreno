import { FOOD_BY_ID, FOODS, type Food } from '../data/foods';
import { MENU, type MenuMeal } from '../data/menu';
import type { FoodItem, MealLog } from './types';

export interface Totals { kcal: number; protein: number; unknown: number }

export function itemTotals(it: FoodItem): Totals {
  const f = FOOD_BY_ID[it.foodId];
  if (!f || !(it.grams >= 0)) return { kcal: 0, protein: 0, unknown: 1 };
  return { kcal: (f.kcal * it.grams) / 100, protein: (f.protein * it.grams) / 100, unknown: 0 };
}

export function sumItems(items: FoodItem[]): Totals {
  return items.reduce<Totals>((a, it) => {
    const t = itemTotals(it);
    return { kcal: a.kcal + t.kcal, protein: a.protein + t.protein, unknown: a.unknown + t.unknown };
  }, { kcal: 0, protein: 0, unknown: 0 });
}

/**
 * Totales de una comida registrada. Si es texto libre sin alimentos del catálogo
 * no se estima nada: solo se usan valores que vos hayas cargado a mano.
 */
export function mealLogTotals(m: MealLog): { kcal: number | null; protein: number | null; estimated: 'catalogo' | 'manual' | 'sin-datos' } {
  if (m.items.length > 0) {
    const t = sumItems(m.items);
    return { kcal: t.kcal, protein: t.protein, estimated: 'catalogo' };
  }
  if (m.manualKcal != null || m.manualProtein != null) {
    return { kcal: m.manualKcal ?? null, protein: m.manualProtein ?? null, estimated: 'manual' };
  }
  return { kcal: null, protein: null, estimated: 'sin-datos' };
}

export function dayLogTotals(meals: MealLog[]) {
  let kcal = 0, protein = 0, withoutData = 0;
  for (const m of meals) {
    const t = mealLogTotals(m);
    if (t.kcal == null && t.protein == null) withoutData++;
    kcal += t.kcal ?? 0;
    protein += t.protein ?? 0;
  }
  return { kcal, protein, withoutData };
}

export function mealVariant(meal: MenuMeal, noEgg: boolean) {
  return noEgg && meal.noEgg ? meal.noEgg : meal;
}

export function menuDayTotals(day: number, noEgg = false): Totals {
  const d = MENU.find((m) => m.day === day);
  if (!d) return { kcal: 0, protein: 0, unknown: 0 };
  return sumItems(Object.values(d.meals).flatMap((m) => mealVariant(m, noEgg).items));
}

/** Día del menú (1 = lunes … 7 = domingo) para un día de la semana JS (0 = domingo). */
export function menuDayForWeekday(wd: number) { return wd === 0 ? 7 : wd; }

/**
 * Sustituciones con porciones comparables:
 * - proteínas: misma proteína
 * - carbohidratos, frutas, grasas: mismas calorías
 * - verduras: mismo peso
 */
export function substitutes(it: FoodItem, opts: { dairy: boolean }): { food: Food; grams: number }[] {
  const f = FOOD_BY_ID[it.foodId];
  if (!f) return [];
  return FOODS.filter((o) => o.id !== f.id && o.group === f.group && (opts.dairy || !o.dairy) && !o.egg)
    .map((o) => {
      let grams: number;
      if (f.group === 'proteina' || f.group === 'lacteo') grams = o.protein > 0 ? (it.grams * f.protein) / o.protein : 0;
      else if (f.group === 'verdura') grams = it.grams;
      else grams = o.kcal > 0 ? (it.grams * f.kcal) / o.kcal : 0;
      return { food: o, grams: Math.round(grams / 5) * 5 };
    })
    .filter((s) => s.grams > 0 && s.grams <= 1000);
}

/** Lista de compras: suma de gramos por alimento para los días pedidos. */
export function shoppingList(days: number[] = [1, 2, 3, 4, 5, 6, 7], noEgg = false) {
  const acc = new Map<string, number>();
  for (const d of MENU.filter((m) => days.includes(m.day))) {
    for (const meal of Object.values(d.meals)) {
      for (const it of mealVariant(meal, noEgg).items) acc.set(it.foodId, (acc.get(it.foodId) ?? 0) + it.grams);
    }
  }
  const groups: Record<string, { food: Food; grams: number }[]> = {};
  for (const [id, grams] of acc) {
    const food = FOOD_BY_ID[id];
    (groups[food.group] ??= []).push({ food, grams });
  }
  for (const g of Object.values(groups)) g.sort((a, b) => a.food.name.localeCompare(b.food.name, 'es'));
  return groups;
}

/** Tareas de preparación anticipada calculadas desde el menú. */
export function prepTasks(days: number[]) {
  const sum = (ids: string[]) => {
    let g = 0;
    for (const d of MENU.filter((m) => days.includes(m.day)))
      for (const meal of Object.values(d.meals)) for (const it of meal.items) if (ids.includes(it.foodId)) g += it.grams;
    return g;
  };
  const tasks: string[] = [];
  const rice = sum(['arroz-crudo']);
  if (rice) tasks.push(`Hervir ${rice} g de arroz (peso crudo). Enfriar rápido y guardar en heladera en porciones (hasta 3 días).`);
  const chicken = sum(['pollo-pechuga-cruda']);
  if (chicken) tasks.push(`Cocinar ${chicken} g de pechuga de pollo (peso crudo) a la plancha u horno. Separar porciones; lo de desayunos y meriendas va desmenuzado.`);
  const potato = sum(['papa-cruda', 'batata-cruda']);
  if (potato) tasks.push(`Lavar y cortar ${potato} g de papa/batata; podés dejar hervidas las de puré.`);
  const veg = sum(['zanahoria', 'chaucha', 'brocoli', 'zapallo', 'zapallito', 'morron', 'cebolla']);
  if (veg) tasks.push(`Lavar y cortar ~${veg} g de verduras de cocción; guardar en recipientes.`);
  const lentils = sum(['lentejas-cocidas']);
  if (lentils) tasks.push(`Cocinar lentejas para obtener ${lentils} g cocidas (≈ ${Math.round(lentils / 2.5)} g secas).`);
  tasks.push('Lavar lechuga y tomates; dejar fruta a la vista.');
  return tasks;
}
