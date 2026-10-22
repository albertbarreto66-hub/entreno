import type { FoodItem, MealSlot } from '../lib/types';

/**
 * Menú inicial de 7 días. Pesos en gramos en el estado indicado por cada alimento del
 * catálogo (crudo / cocido / listo). Las calorías y proteínas NO se escriben a mano:
 * se calculan desde el catálogo (ver src/lib/nutrition.ts) para que sean comprobables.
 */
export interface MenuMeal {
  title: string;
  items: FoodItem[];
  recipe: string;
  noEgg?: { title: string; items: FoodItem[]; recipe: string };
  dairyOption?: { label: string; items: FoodItem[] };
}
export interface MenuDay { day: number; name: string; meals: Record<Exclude<MealSlot, 'extra'>, MenuMeal> }

const i = (foodId: string, grams: number): FoodItem => ({ foodId, grams });

export const MENU: MenuDay[] = [
  {
    day: 1, name: 'Lunes', meals: {
      desayuno: { title: 'Tostadas con jamón y tomate + banana', items: [i('pan-frances', 100), i('jamon-cocido', 60), i('tomate', 80), i('banana', 120)],
        recipe: 'Tostá el pan, sumá jamón y rodajas de tomate. Banana aparte.' },
      almuerzo: { title: 'Pollo a la plancha con arroz y ensalada', items: [i('pollo-pechuga-cruda', 230), i('arroz-crudo', 110), i('lechuga', 50), i('tomate', 100), i('zanahoria', 50), i('aceite', 10)],
        recipe: 'Pollo a la plancha con sal y especias. Arroz hervido (de la preparación anticipada). Ensalada con el aceite medido.' },
      merienda: { title: 'Sándwich de atún + manzana', items: [i('pan-integral', 80), i('atun-al-natural', 80), i('tomate', 50), i('manzana', 180), i('almendras', 15)],
        recipe: 'Atún escurrido con tomate en pan integral. Manzana y un puñado chico de almendras.', dairyOption: { label: 'Sumar yogur natural', items: [i('yogur-natural-desc', 150)] } },
      cena: { title: 'Carne al horno con papas y chauchas', items: [i('carne-magra-cruda', 230), i('papa-cruda', 400), i('chaucha', 150), i('aceite', 12)],
        recipe: 'Carne y papas en bastones al horno con el aceite medido. Chauchas hervidas o al vapor.' },
    },
  },
  {
    day: 2, name: 'Martes', meals: {
      desayuno: { title: 'Tostadas integrales con palta y pollo + naranja', items: [i('pan-integral', 100), i('palta', 50), i('pollo-pechuga-cruda', 80), i('naranja', 180)],
        recipe: 'Usá pollo ya cocido de la preparación (80 g en crudo ≈ 55–60 g cocido). Pisá la palta sobre las tostadas.' },
      almuerzo: { title: 'Bowl de carne picada, arroz y morrón', items: [i('carne-picada-90', 200), i('arroz-crudo', 110), i('morron', 80), i('cebolla', 60), i('aceite', 8)],
        recipe: 'Salteá cebolla y morrón con el aceite, sumá la carne y cociná. Serví sobre el arroz.' },
      merienda: { title: 'Galletas de arroz con jamón + banana + almendras', items: [i('galletas-arroz', 36), i('jamon-cocido', 80), i('banana', 120), i('almendras', 20)],
        recipe: '4 galletas de arroz con jamón. Banana y un puñado chico de almendras.' },
      cena: { title: 'Merluza al horno con batata y brócoli', items: [i('merluza-cruda', 280), i('batata-cruda', 400), i('brocoli', 150), i('aceite', 10), i('limon-jugo', 10)],
        recipe: 'Merluza al horno con limón. Batata en rodajas al horno con el aceite. Brócoli al vapor.' },
    },
  },
  {
    day: 3, name: 'Miércoles', meals: {
      desayuno: { title: 'Revuelto de 2 huevos con tostadas + mandarinas', items: [i('huevo', 100), i('pan-frances', 100), i('tomate', 80), i('mandarina', 180)],
        recipe: 'Revuelto en sartén antiadherente. Tostadas y tomate.',
        noEgg: { title: 'Tostadas con jamón y tomate + mandarinas', items: [i('jamon-cocido', 80), i('pan-frances', 100), i('tomate', 80), i('mandarina', 180)],
          recipe: 'Igual que el desayuno del lunes, sin huevo.' } },
      almuerzo: { title: 'Muslos de pollo con papa y calabaza al horno', items: [i('pollo-muslo-crudo', 250), i('papa-cruda', 350), i('zapallo', 150), i('aceite', 10)],
        recipe: 'Todo a la misma fuente con el aceite medido y especias, horno fuerte ~40 min.' },
      merienda: { title: 'Sándwich de pollo + pera', items: [i('pan-frances', 90), i('pollo-pechuga-cruda', 100), i('lechuga', 20), i('tomate', 50), i('pera', 180)],
        recipe: 'Pollo ya cocido de la preparación (100 g en crudo ≈ 70 g cocido), lechuga y tomate.' },
      cena: { title: 'Fideos con salsa boloñesa', items: [i('fideos-secos', 110), i('carne-picada-90', 180), i('tomate', 150), i('cebolla', 50), i('aceite', 8)],
        recipe: 'Salsa con cebolla, carne y tomate triturado. Fideos al dente.' },
    },
  },
  {
    day: 4, name: 'Jueves', meals: {
      desayuno: { title: 'Tostadas integrales con atún y tomate + banana', items: [i('pan-integral', 90), i('atun-al-natural', 80), i('tomate', 80), i('banana', 120)],
        recipe: 'Atún escurrido sobre tostadas con tomate.' },
      almuerzo: { title: 'Carne a la plancha con arroz, chauchas y zanahoria', items: [i('carne-magra-cruda', 230), i('arroz-crudo', 110), i('chaucha', 100), i('zanahoria', 80), i('aceite', 10)],
        recipe: 'Carne a la plancha. Arroz de la preparación. Verduras al vapor con el aceite.' },
      merienda: { title: 'Galletas de arroz con jamón + kiwi + nueces', items: [i('galletas-arroz', 36), i('jamon-cocido', 60), i('kiwi', 150), i('nueces', 15)],
        recipe: '4 galletas con jamón, 2 kiwis y un puñado chico de nueces.' },
      cena: { title: 'Milanesas de pollo al horno con puré rústico y ensalada', items: [i('pollo-pechuga-cruda', 250), i('pan-rallado', 40), i('huevo', 25), i('aceite', 10), i('papa-cruda', 300), i('lechuga', 50), i('tomate', 100)],
        recipe: 'Pasá las pechugas fileteadas por medio huevo batido y pan rallado; horno con el aceite pincelado. Papas hervidas y pisadas con cáscara.',
        noEgg: { title: 'Milanesas de pollo al horno (rebozado con mostaza)', items: [i('pollo-pechuga-cruda', 250), i('pan-rallado', 40), i('mostaza', 15), i('aceite', 10), i('papa-cruda', 300), i('lechuga', 50), i('tomate', 100)],
          recipe: 'Pincelá las pechugas con mostaza en lugar de huevo y pasalas por pan rallado. Resto igual.' } },
    },
  },
  {
    day: 5, name: 'Viernes', meals: {
      desayuno: { title: 'Tostadas con jamón + frutillas', items: [i('pan-frances', 110), i('jamon-cocido', 60), i('tomate', 60), i('frutillas', 200), i('mermelada', 15)],
        recipe: 'Una tostada con jamón y tomate, otra con mermelada. Frutillas aparte.' },
      almuerzo: { title: 'Solomillo de cerdo con batata y brócoli', items: [i('cerdo-solomillo-crudo', 230), i('batata-cruda', 400), i('brocoli', 120), i('aceite', 10)],
        recipe: 'Solomillo al horno o a la plancha. Batata al horno con el aceite. Brócoli al vapor.' },
      merienda: { title: 'Sándwich integral de pollo y palta + manzana', items: [i('pan-integral', 80), i('pollo-pechuga-cruda', 100), i('palta', 40), i('manzana', 180), i('almendras', 15)],
        recipe: 'Pollo ya cocido de la preparación con palta pisada. Manzana y unas almendras.', dairyOption: { label: 'Sumar ricota en el sándwich', items: [i('ricota-desc', 40)] } },
      cena: { title: 'Guiso de lentejas con carne y verduras', items: [i('lentejas-cocidas', 250), i('carne-magra-cruda', 150), i('papa-cruda', 150), i('zanahoria', 80), i('cebolla', 60), i('morron', 50), i('aceite', 8)],
        recipe: 'Rehogá cebolla y morrón, sumá carne en cubos, papa, zanahoria y lentejas cocidas con caldo casero. Si las legumbres te generan hinchazón, cambialas por arroz desde "Modificar".' },
    },
  },
  {
    day: 6, name: 'Sábado', meals: {
      desayuno: { title: 'Tostadas con palta y jamón + naranja', items: [i('pan-frances', 100), i('palta', 50), i('jamon-cocido', 60), i('naranja', 180)],
        recipe: 'Tostadas con palta pisada y jamón.' },
      almuerzo: { title: 'Hamburguesas caseras con papas al horno', items: [i('carne-picada-90', 220), i('pan-frances', 80), i('lechuga', 30), i('tomate', 80), i('papa-cruda', 250), i('aceite', 8)],
        recipe: 'Formá 2 hamburguesas con la carne condimentada, a la plancha. Papas en gajos al horno con el aceite.' },
      merienda: { title: 'Sándwich de jamón + mandarinas', items: [i('pan-integral', 80), i('jamon-cocido', 60), i('tomate', 50), i('mandarina', 180)],
        recipe: 'Sándwich simple. Dos mandarinas.', dairyOption: { label: 'Sumar yogur natural', items: [i('yogur-natural-desc', 150)] } },
      cena: { title: 'Pollo al horno con papa, calabaza y cebolla', items: [i('pollo-pechuga-cruda', 250), i('papa-cruda', 300), i('zapallo', 150), i('cebolla', 80), i('aceite', 12)],
        recipe: 'Todo en una fuente con el aceite y especias, ~40 min.' },
    },
  },
  {
    day: 7, name: 'Domingo', meals: {
      desayuno: { title: 'Tostadas integrales con pollo, palta y tomate + banana', items: [i('pan-integral', 90), i('pollo-pechuga-cruda', 80), i('palta', 40), i('tomate', 80), i('banana', 120)],
        recipe: 'Pollo cocido del día anterior en tostadas con tomate.' },
      almuerzo: { title: 'Carne magra a la parrilla con papa y ensalada mixta', items: [i('carne-magra-cruda', 220), i('papa-cruda', 450), i('lechuga', 60), i('tomate', 120), i('zanahoria', 60), i('aceite', 10)],
        recipe: 'Cortes magros (peceto, nalga, colita de cuadril desgrasada). Papa al rescoldo o hervida. Ensalada con el aceite.' },
      merienda: { title: 'Sándwich de atún + kiwi', items: [i('pan-integral', 80), i('atun-al-natural', 80), i('tomate', 50), i('kiwi', 150), i('almendras', 15)],
        recipe: 'Atún con tomate. Dos kiwis y unas almendras.' },
      cena: { title: 'Merluza con arroz y zapallitos', items: [i('merluza-cruda', 280), i('arroz-crudo', 110), i('zapallito', 150), i('aceite', 12), i('limon-jugo', 10)],
        recipe: 'Merluza a la plancha o al horno con limón. Arroz y zapallitos salteados con el aceite.' },
    },
  },
];

/** Preparación anticipada: domingo y miércoles. */
export const PREP_DAYS = [
  { name: 'Domingo', covers: [1, 2, 3], note: 'Cubre lunes a miércoles.' },
  { name: 'Miércoles', covers: [4, 5, 6, 7], note: 'Cubre jueves a domingo (el fin de semana podés cocinar en el momento).' },
];

/** Agua saborizada: para disfrutar, sin efectos atribuidos. */
export const FLAVORED_WATERS = [
  { id: 'pepino', label: 'Agua con pepino', how: 'Rodajas finas de pepino en 1 litro de agua fría, 1–2 h en la heladera.' },
  { id: 'limon', label: 'Agua con limón', how: 'Rodajas o el jugo de medio limón en 1 litro de agua.' },
  { id: 'pepino-limon', label: 'Agua con pepino y limón', how: 'Pepino en rodajas + medio limón en 1 litro.' },
  { id: 'jengibre', label: 'Agua con jengibre suave (opcional)', how: '2–3 rodajas finas de jengibre fresco en 1 litro; dejá reposar y retiralas.' },
];
export const FLAVORED_NOTE =
  'Son opciones para disfrutar el agua. No queman grasa, no "desintoxican" ni garantizan deshinchar. El limón o el jengibre pueden molestar si te dan acidez: en ese caso, evitalos.';
