/**
 * Catálogo local de alimentos — valores APROXIMADOS por 100 g.
 *
 * Fuente principal: USDA FoodData Central, base "SR Legacy" (se cita la descripción
 * del alimento en inglés para que se pueda buscar en https://fdc.nal.usda.gov/).
 * Los valores están redondeados. Donde no hay una entrada equivalente clara se marca
 * como "Estimación aproximada" y no se presenta como dato de una fuente.
 * Las preparaciones reales varían: esto es una referencia, no una medición.
 */
export type FoodGroup = 'proteina' | 'carbohidrato' | 'fruta' | 'verdura' | 'grasa' | 'lacteo' | 'otro';

export interface Food {
  id: string;
  name: string;
  state: 'crudo' | 'cocido' | 'listo' | 'polvo';
  kcal: number; // por 100 g
  protein: number; // g por 100 g
  carbs: number; // g por 100 g
  fat: number; // g por 100 g
  fiber: number; // g por 100 g
  group: FoodGroup;
  source: string;
  egg?: boolean;
  dairy?: boolean;
  unit?: { label: string; grams: number }; // porción casera orientativa
}

const U = (d: string) => `USDA FDC SR Legacy: "${d}" (aprox.)`;
const EST = 'Estimación aproximada (sin fuente verificada en el catálogo)';

type Row = [id: string, name: string, state: Food['state'], kcal: number, p: number, c: number, f: number, fib: number, group: FoodGroup, source: string, extra?: Partial<Food>];
const rows: Row[] = [
  // Proteínas
  ['pollo-pechuga-cruda', 'Pechuga de pollo sin piel', 'crudo', 120, 22.5, 0, 2.6, 0, 'proteina', U('Chicken, broilers or fryers, breast, meat only, raw')],
  ['pollo-muslo-crudo', 'Muslo de pollo sin piel', 'crudo', 120, 19.7, 0, 3.9, 0, 'proteina', U('Chicken, broilers or fryers, thigh, meat only, raw')],
  ['carne-magra-cruda', 'Carne vacuna magra (nalga, cuadrada, peceto, bife)', 'crudo', 130, 23, 0, 4, 0, 'proteina', U('Beef, round, top round, separable lean only, raw')],
  ['carne-picada-90', 'Carne picada especial (90% magra)', 'crudo', 176, 20, 0, 10, 0, 'proteina', U('Beef, ground, 90% lean meat / 10% fat, raw')],
  ['cerdo-solomillo-crudo', 'Solomillo de cerdo', 'crudo', 120, 21, 0, 3.5, 0, 'proteina', U('Pork, fresh, loin, tenderloin, separable lean only, raw')],
  ['cerdo-carre-crudo', 'Carré de cerdo sin grasa visible', 'crudo', 143, 21, 0, 6, 0, 'proteina', EST + ' — lomo de cerdo magro'],
  ['merluza-cruda', 'Merluza (filet)', 'crudo', 85, 18, 0, 1.2, 0, 'proteina', EST + ' — similar a pescado blanco magro'],
  ['atun-al-natural', 'Atún al natural, escurrido', 'listo', 116, 25.5, 0, 0.8, 0, 'proteina', U('Fish, tuna, light, canned in water, drained solids')],
  ['jamon-cocido', 'Jamón cocido magro', 'listo', 120, 18, 1.5, 4, 0, 'proteina', EST + ' — varía mucho según marca; revisá la etiqueta'],
  ['huevo', 'Huevo entero', 'crudo', 143, 12.6, 0.7, 9.5, 0, 'proteina', U('Egg, whole, raw, fresh'), { egg: true, unit: { label: 'huevo', grams: 50 } }],
  ['whey', 'Proteína whey (en agua)', 'polvo', 390, 78, 8, 6, 0, 'proteina', EST + ' — varía según marca: usá los valores de la etiqueta de la tuya', { unit: { label: 'scoop', grams: 30 } }],
  ['lentejas-cocidas', 'Lentejas', 'cocido', 116, 9, 20.1, 0.4, 7.9, 'proteina', U('Lentils, mature seeds, cooked, boiled, without salt')],
  ['garbanzos-cocidos', 'Garbanzos', 'cocido', 164, 8.9, 27.4, 2.6, 7.6, 'proteina', U('Chickpeas (garbanzo beans), mature seeds, cooked, boiled, without salt')],

  // Carbohidratos
  ['arroz-crudo', 'Arroz blanco', 'crudo', 365, 7.1, 80, 0.7, 1.3, 'carbohidrato', U('Rice, white, long-grain, regular, raw, enriched')],
  ['arroz-cocido', 'Arroz blanco', 'cocido', 130, 2.7, 28.2, 0.3, 0.4, 'carbohidrato', U('Rice, white, long-grain, regular, enriched, cooked')],
  ['papa-cruda', 'Papa con cáscara', 'crudo', 77, 2, 17.5, 0.1, 2.1, 'carbohidrato', U('Potatoes, flesh and skin, raw')],
  ['batata-cruda', 'Batata', 'crudo', 86, 1.6, 20.1, 0.1, 3, 'carbohidrato', U('Sweet potato, raw, unprepared')],
  ['fideos-secos', 'Fideos secos', 'crudo', 371, 13, 75, 1.5, 3.2, 'carbohidrato', U('Pasta, dry, enriched')],
  ['pan-frances', 'Pan francés', 'listo', 275, 9, 56, 1.5, 2.5, 'carbohidrato', EST + ' — pan blanco tipo francés'],
  ['pan-integral', 'Pan integral', 'listo', 252, 12.4, 43, 3.5, 6, 'carbohidrato', U('Bread, whole-wheat, commercially prepared')],
  ['galletas-arroz', 'Galletas de arroz', 'listo', 387, 8.2, 81.5, 2.8, 4.2, 'carbohidrato', U('Snacks, rice cakes, brown rice, plain'), { unit: { label: 'galleta', grams: 9 } }],
  ['pan-rallado', 'Pan rallado', 'listo', 395, 13.4, 72, 5.3, 4.5, 'carbohidrato', U('Bread, crumbs, dry, grated, plain')],
  ['choclo', 'Choclo en granos', 'crudo', 86, 3.3, 19, 1.4, 2, 'carbohidrato', U('Corn, sweet, yellow, raw')],

  // Frutas
  ['banana', 'Banana', 'crudo', 89, 1.1, 22.8, 0.3, 2.6, 'fruta', U('Bananas, raw'), { unit: { label: 'banana mediana', grams: 120 } }],
  ['manzana', 'Manzana', 'crudo', 52, 0.3, 13.8, 0.2, 2.4, 'fruta', U('Apples, raw, with skin'), { unit: { label: 'manzana mediana', grams: 180 } }],
  ['naranja', 'Naranja', 'crudo', 47, 0.9, 11.8, 0.1, 2.4, 'fruta', U('Oranges, raw, all commercial varieties'), { unit: { label: 'naranja mediana', grams: 180 } }],
  ['mandarina', 'Mandarina', 'crudo', 53, 0.8, 13.3, 0.3, 1.8, 'fruta', U('Tangerines, (mandarin oranges), raw'), { unit: { label: 'mandarina', grams: 90 } }],
  ['frutillas', 'Frutillas', 'crudo', 32, 0.7, 7.7, 0.3, 2, 'fruta', U('Strawberries, raw')],
  ['pera', 'Pera', 'crudo', 57, 0.4, 15.2, 0.1, 3.1, 'fruta', U('Pears, raw'), { unit: { label: 'pera mediana', grams: 180 } }],
  ['kiwi', 'Kiwi', 'crudo', 61, 1.1, 14.7, 0.5, 3, 'fruta', U('Kiwifruit, green, raw'), { unit: { label: 'kiwi', grams: 75 } }],

  // Verduras
  ['tomate', 'Tomate', 'crudo', 18, 0.9, 3.9, 0.2, 1.2, 'verdura', U('Tomatoes, red, ripe, raw, year round average')],
  ['lechuga', 'Lechuga', 'crudo', 15, 1.4, 2.9, 0.2, 1.3, 'verdura', U('Lettuce, green leaf, raw')],
  ['zanahoria', 'Zanahoria', 'crudo', 41, 0.9, 9.6, 0.2, 2.8, 'verdura', U('Carrots, raw')],
  ['zapallo', 'Zapallo / calabaza', 'crudo', 45, 1, 11.7, 0.1, 2, 'verdura', U('Squash, winter, butternut, raw')],
  ['zapallito', 'Zapallito / zucchini', 'crudo', 17, 1.2, 3.1, 0.3, 1, 'verdura', U('Squash, summer, zucchini, includes skin, raw')],
  ['brocoli', 'Brócoli', 'crudo', 34, 2.8, 6.6, 0.4, 2.6, 'verdura', U('Broccoli, raw')],
  ['cebolla', 'Cebolla', 'crudo', 40, 1.1, 9.3, 0.1, 1.7, 'verdura', U('Onions, raw')],
  ['morron', 'Morrón rojo', 'crudo', 31, 1, 6, 0.3, 2.1, 'verdura', U('Peppers, sweet, red, raw')],
  ['espinaca', 'Espinaca', 'crudo', 23, 2.9, 3.6, 0.4, 2.2, 'verdura', U('Spinach, raw')],
  ['pepino', 'Pepino', 'crudo', 15, 0.7, 3.6, 0.1, 0.5, 'verdura', U('Cucumber, with peel, raw')],
  ['chaucha', 'Chauchas', 'crudo', 31, 1.8, 7, 0.2, 2.7, 'verdura', U('Beans, snap, green, raw')],
  ['rucula', 'Rúcula', 'crudo', 25, 2.6, 3.7, 0.7, 1.6, 'verdura', U('Arugula, raw')],
  ['repollo', 'Repollo', 'crudo', 25, 1.3, 5.8, 0.1, 2.5, 'verdura', U('Cabbage, raw')],

  // Grasas y aderezos
  ['aceite', 'Aceite (girasol u oliva)', 'listo', 884, 0, 0, 100, 0, 'grasa', U('Oil, olive, salad or cooking'), { unit: { label: 'cucharada', grams: 13 } }],
  ['palta', 'Palta', 'crudo', 160, 2, 8.5, 14.7, 6.7, 'grasa', U('Avocados, raw, all commercial varieties')],
  ['almendras', 'Almendras', 'crudo', 579, 21, 21.6, 50, 12.5, 'grasa', U('Nuts, almonds')],
  ['nueces', 'Nueces', 'crudo', 654, 15, 13.7, 65, 6.7, 'grasa', U('Nuts, english walnuts')],
  ['mostaza', 'Mostaza', 'listo', 60, 3.7, 5.8, 3.3, 4, 'otro', U('Mustard, prepared, yellow')],
  ['mermelada', 'Mermelada', 'listo', 250, 0.4, 69, 0.1, 1, 'otro', U('Jams and preserves')],
  ['miel', 'Miel', 'listo', 304, 0.3, 82, 0, 0.2, 'otro', U('Honey')],
  ['limon-jugo', 'Jugo de limón', 'listo', 22, 0.4, 6.9, 0.2, 0.3, 'otro', U('Lemon juice, raw')],

  // Lácteos (desactivados al inicio; se habilitan en Ajustes)
  ['yogur-natural-desc', 'Yogur natural descremado', 'listo', 56, 5.7, 7.7, 0.2, 0, 'lacteo', U('Yogurt, plain, skim milk, 13 grams protein per 8 ounce'), { dairy: true }],
  ['ricota-desc', 'Ricota descremada', 'listo', 138, 11.4, 5.1, 7.9, 0, 'lacteo', U('Cheese, ricotta, part skim milk'), { dairy: true }],
];

export const FOODS: Food[] = rows.map(([id, name, state, kcal, protein, carbs, fat, fiber, group, source, extra]) => ({
  id, name, state, kcal, protein, carbs, fat, fiber, group, source, ...extra,
}));

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export function foodLabel(f: Food) {
  return `${f.name} (${f.state})`;
}
