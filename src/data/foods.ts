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
  state: 'crudo' | 'cocido' | 'listo';
  kcal: number; // por 100 g
  protein: number; // g por 100 g
  group: FoodGroup;
  source: string;
  egg?: boolean;
  dairy?: boolean;
  unit?: { label: string; grams: number }; // porción casera orientativa
}

const U = (d: string) => `USDA FDC SR Legacy: "${d}" (aprox.)`;
const EST = 'Estimación aproximada (sin fuente verificada en el catálogo)';

export const FOODS: Food[] = [
  // Proteínas
  { id: 'pollo-pechuga-cruda', name: 'Pechuga de pollo sin piel', state: 'crudo', kcal: 120, protein: 22.5, group: 'proteina', source: U('Chicken, broilers or fryers, breast, meat only, raw') },
  { id: 'pollo-muslo-crudo', name: 'Muslo de pollo sin piel', state: 'crudo', kcal: 120, protein: 19.7, group: 'proteina', source: U('Chicken, broilers or fryers, thigh, meat only, raw') },
  { id: 'carne-magra-cruda', name: 'Carne vacuna magra (nalga, cuadrada, peceto)', state: 'crudo', kcal: 130, protein: 23, group: 'proteina', source: U('Beef, round, top round, separable lean only, raw') },
  { id: 'carne-picada-90', name: 'Carne picada especial (90% magra)', state: 'crudo', kcal: 176, protein: 20, group: 'proteina', source: U('Beef, ground, 90% lean meat / 10% fat, raw') },
  { id: 'cerdo-solomillo-crudo', name: 'Solomillo de cerdo', state: 'crudo', kcal: 120, protein: 21, group: 'proteina', source: U('Pork, fresh, loin, tenderloin, separable lean only, raw') },
  { id: 'merluza-cruda', name: 'Merluza (filet)', state: 'crudo', kcal: 85, protein: 18, group: 'proteina', source: EST + ' — similar a pescado blanco magro' },
  { id: 'atun-al-natural', name: 'Atún al natural, escurrido', state: 'listo', kcal: 116, protein: 25.5, group: 'proteina', source: U('Fish, tuna, light, canned in water, drained solids') },
  { id: 'jamon-cocido', name: 'Jamón cocido magro', state: 'listo', kcal: 120, protein: 18, group: 'proteina', source: EST + ' — varía mucho según marca; revisá la etiqueta' },
  { id: 'huevo', name: 'Huevo entero', state: 'crudo', kcal: 143, protein: 12.6, group: 'proteina', egg: true, unit: { label: 'huevo', grams: 50 }, source: U('Egg, whole, raw, fresh') },
  { id: 'lentejas-cocidas', name: 'Lentejas', state: 'cocido', kcal: 116, protein: 9, group: 'proteina', source: U('Lentils, mature seeds, cooked, boiled, without salt') },
  { id: 'garbanzos-cocidos', name: 'Garbanzos', state: 'cocido', kcal: 164, protein: 8.9, group: 'proteina', source: U('Chickpeas (garbanzo beans), mature seeds, cooked, boiled, without salt') },

  // Carbohidratos
  { id: 'arroz-crudo', name: 'Arroz blanco', state: 'crudo', kcal: 365, protein: 7.1, group: 'carbohidrato', source: U('Rice, white, long-grain, regular, raw, enriched') },
  { id: 'arroz-cocido', name: 'Arroz blanco', state: 'cocido', kcal: 130, protein: 2.7, group: 'carbohidrato', source: U('Rice, white, long-grain, regular, enriched, cooked') },
  { id: 'papa-cruda', name: 'Papa con cáscara', state: 'crudo', kcal: 77, protein: 2, group: 'carbohidrato', source: U('Potatoes, flesh and skin, raw') },
  { id: 'batata-cruda', name: 'Batata', state: 'crudo', kcal: 86, protein: 1.6, group: 'carbohidrato', source: U('Sweet potato, raw, unprepared') },
  { id: 'fideos-secos', name: 'Fideos secos', state: 'crudo', kcal: 371, protein: 13, group: 'carbohidrato', source: U('Pasta, dry, enriched') },
  { id: 'pan-frances', name: 'Pan francés', state: 'listo', kcal: 275, protein: 9, group: 'carbohidrato', source: EST + ' — pan blanco tipo francés' },
  { id: 'pan-integral', name: 'Pan integral', state: 'listo', kcal: 252, protein: 12.4, group: 'carbohidrato', source: U('Bread, whole-wheat, commercially prepared') },
  { id: 'galletas-arroz', name: 'Galletas de arroz', state: 'listo', kcal: 387, protein: 8.2, group: 'carbohidrato', unit: { label: 'galleta', grams: 9 }, source: U('Snacks, rice cakes, brown rice, plain') },
  { id: 'pan-rallado', name: 'Pan rallado', state: 'listo', kcal: 395, protein: 13.4, group: 'carbohidrato', source: U('Bread, crumbs, dry, grated, plain') },
  { id: 'choclo', name: 'Choclo en granos', state: 'crudo', kcal: 86, protein: 3.3, group: 'carbohidrato', source: U('Corn, sweet, yellow, raw') },

  // Frutas
  { id: 'banana', name: 'Banana', state: 'crudo', kcal: 89, protein: 1.1, group: 'fruta', unit: { label: 'banana mediana', grams: 120 }, source: U('Bananas, raw') },
  { id: 'manzana', name: 'Manzana', state: 'crudo', kcal: 52, protein: 0.3, group: 'fruta', unit: { label: 'manzana mediana', grams: 180 }, source: U('Apples, raw, with skin') },
  { id: 'naranja', name: 'Naranja', state: 'crudo', kcal: 47, protein: 0.9, group: 'fruta', unit: { label: 'naranja mediana', grams: 180 }, source: U('Oranges, raw, all commercial varieties') },
  { id: 'mandarina', name: 'Mandarina', state: 'crudo', kcal: 53, protein: 0.8, group: 'fruta', unit: { label: 'mandarina', grams: 90 }, source: U('Tangerines, (mandarin oranges), raw') },
  { id: 'frutillas', name: 'Frutillas', state: 'crudo', kcal: 32, protein: 0.7, group: 'fruta', source: U('Strawberries, raw') },
  { id: 'pera', name: 'Pera', state: 'crudo', kcal: 57, protein: 0.4, group: 'fruta', unit: { label: 'pera mediana', grams: 180 }, source: U('Pears, raw') },
  { id: 'kiwi', name: 'Kiwi', state: 'crudo', kcal: 61, protein: 1.1, group: 'fruta', unit: { label: 'kiwi', grams: 75 }, source: U('Kiwifruit, green, raw') },

  // Verduras
  { id: 'tomate', name: 'Tomate', state: 'crudo', kcal: 18, protein: 0.9, group: 'verdura', source: U('Tomatoes, red, ripe, raw, year round average') },
  { id: 'lechuga', name: 'Lechuga', state: 'crudo', kcal: 15, protein: 1.4, group: 'verdura', source: U('Lettuce, green leaf, raw') },
  { id: 'zanahoria', name: 'Zanahoria', state: 'crudo', kcal: 41, protein: 0.9, group: 'verdura', source: U('Carrots, raw') },
  { id: 'zapallo', name: 'Zapallo / calabaza', state: 'crudo', kcal: 45, protein: 1, group: 'verdura', source: U('Squash, winter, butternut, raw') },
  { id: 'zapallito', name: 'Zapallito / zucchini', state: 'crudo', kcal: 17, protein: 1.2, group: 'verdura', source: U('Squash, summer, zucchini, includes skin, raw') },
  { id: 'brocoli', name: 'Brócoli', state: 'crudo', kcal: 34, protein: 2.8, group: 'verdura', source: U('Broccoli, raw') },
  { id: 'cebolla', name: 'Cebolla', state: 'crudo', kcal: 40, protein: 1.1, group: 'verdura', source: U('Onions, raw') },
  { id: 'morron', name: 'Morrón rojo', state: 'crudo', kcal: 31, protein: 1, group: 'verdura', source: U('Peppers, sweet, red, raw') },
  { id: 'espinaca', name: 'Espinaca', state: 'crudo', kcal: 23, protein: 2.9, group: 'verdura', source: U('Spinach, raw') },
  { id: 'pepino', name: 'Pepino', state: 'crudo', kcal: 15, protein: 0.7, group: 'verdura', source: U('Cucumber, with peel, raw') },
  { id: 'chaucha', name: 'Chauchas', state: 'crudo', kcal: 31, protein: 1.8, group: 'verdura', source: U('Beans, snap, green, raw') },

  // Grasas y aderezos
  { id: 'aceite', name: 'Aceite (girasol u oliva)', state: 'listo', kcal: 884, protein: 0, group: 'grasa', unit: { label: 'cucharada', grams: 13 }, source: U('Oil, olive, salad or cooking') },
  { id: 'palta', name: 'Palta', state: 'crudo', kcal: 160, protein: 2, group: 'grasa', source: U('Avocados, raw, all commercial varieties') },
  { id: 'almendras', name: 'Almendras', state: 'crudo', kcal: 579, protein: 21, group: 'grasa', source: U('Nuts, almonds') },
  { id: 'nueces', name: 'Nueces', state: 'crudo', kcal: 654, protein: 15, group: 'grasa', source: U('Nuts, english walnuts') },
  { id: 'mostaza', name: 'Mostaza', state: 'listo', kcal: 60, protein: 3.7, group: 'otro', source: U('Mustard, prepared, yellow') },
  { id: 'mermelada', name: 'Mermelada', state: 'listo', kcal: 250, protein: 0.4, group: 'otro', source: U('Jams and preserves') },
  { id: 'miel', name: 'Miel', state: 'listo', kcal: 304, protein: 0.3, group: 'otro', source: U('Honey') },
  { id: 'limon-jugo', name: 'Jugo de limón', state: 'listo', kcal: 22, protein: 0.4, group: 'otro', source: U('Lemon juice, raw') },

  // Lácteos (desactivados al inicio; se habilitan en Ajustes)
  { id: 'yogur-natural-desc', name: 'Yogur natural descremado', state: 'listo', kcal: 56, protein: 5.7, group: 'lacteo', dairy: true, source: U('Yogurt, plain, skim milk, 13 grams protein per 8 ounce') },
  { id: 'ricota-desc', name: 'Ricota descremada', state: 'listo', kcal: 138, protein: 11.4, group: 'lacteo', dairy: true, source: U('Cheese, ricotta, part skim milk') },
];

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export function foodLabel(f: Food) {
  return `${f.name} (${f.state})`;
}
