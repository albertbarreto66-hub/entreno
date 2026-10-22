import type { FoodItem, MealSlot } from '../lib/types';

/**
 * Menú inicial. Cada comida tiene un grupo de opciones intercambiables con calorías y
 * proteína parecidas; cada día de la semana trae una opción sugerida y podés elegir otra.
 * Las cenas son sin carbohidratos (carne, pollo o pescado con ensaladas o verduras), por
 * pedido de Albert; los carbohidratos del día van en desayuno, almuerzo y merienda.
 *
 * Pesos en gramos en el estado indicado por cada alimento del catálogo (crudo / cocido /
 * listo). Las calorías y proteínas NO se escriben a mano: se calculan desde el catálogo
 * (ver src/lib/nutrition.ts) para que sean comprobables.
 */
export interface MenuMeal {
  id: string;
  title: string;
  items: FoodItem[];
  recipe: string;
  noEgg?: { title: string; items: FoodItem[]; recipe: string };
  dairyOption?: { label: string; items: FoodItem[] };
}
export type MainSlot = Exclude<MealSlot, 'extra'>;
export interface MenuDay { day: number; name: string; meals: Record<MainSlot, MenuMeal> }

const i = (foodId: string, grams: number): FoodItem => ({ foodId, grams });

/** Alimentos que no van en la cena (carbohidratos principales). */
export const DINNER_EXCLUDED = ['arroz-crudo', 'arroz-cocido', 'papa-cruda', 'batata-cruda', 'fideos-secos', 'pan-frances', 'pan-integral', 'galletas-arroz', 'pan-rallado', 'choclo', 'lentejas-cocidas', 'garbanzos-cocidos', 'mermelada', 'miel'];

export const OPTIONS: Record<MainSlot, MenuMeal[]> = {
  desayuno: [
    { id: 'd-jamon', title: 'Tostadas con jamón y tomate + banana', items: [i('pan-frances', 130), i('jamon-cocido', 70), i('tomate', 80), i('banana', 120)],
      recipe: 'Tostá el pan, sumá jamón y rodajas de tomate. Banana aparte.' },
    { id: 'd-palta-pollo', title: 'Tostadas integrales con palta y pollo + naranja', items: [i('pan-integral', 110), i('palta', 50), i('pollo-pechuga-cruda', 100), i('naranja', 180)],
      recipe: 'Pollo ya cocido de la preparación (100 g en crudo ≈ 70 g cocido). Pisá la palta sobre las tostadas.' },
    { id: 'd-revuelto', title: 'Revuelto de 2 huevos con tostadas + mandarinas', items: [i('huevo', 100), i('pan-frances', 120), i('tomate', 80), i('mandarina', 180)],
      recipe: 'Revuelto en sartén antiadherente. Tostadas y tomate.',
      noEgg: { title: 'Tostadas con jamón y tomate + mandarinas', items: [i('jamon-cocido', 90), i('pan-frances', 120), i('tomate', 80), i('mandarina', 180)], recipe: 'Igual, con jamón en lugar de huevo.' } },
    { id: 'd-atun', title: 'Tostadas integrales con atún y tomate + banana', items: [i('pan-integral', 110), i('atun-al-natural', 90), i('tomate', 80), i('banana', 120), i('almendras', 10)],
      recipe: 'Atún escurrido sobre tostadas con tomate. Banana y unas almendras.' },
    { id: 'd-dulce', title: 'Tostadas con jamón y mermelada + frutillas', items: [i('pan-frances', 130), i('jamon-cocido', 70), i('mermelada', 20), i('frutillas', 200)],
      recipe: 'Una tostada con jamón, otra con mermelada. Frutillas aparte.' },
    { id: 'd-pollo-banana', title: 'Sándwich de pollo y tomate + banana y almendras', items: [i('pan-integral', 100), i('pollo-pechuga-cruda', 100), i('tomate', 60), i('banana', 120), i('almendras', 15)],
      recipe: 'Pollo cocido desmenuzado con tomate. Banana y un puñado chico de almendras.' },
    { id: 'd-galletas', title: 'Galletas de arroz con jamón y palta + manzana', items: [i('galletas-arroz', 63), i('jamon-cocido', 80), i('palta', 50), i('manzana', 180), i('almendras', 10)],
      recipe: '7 galletas de arroz con palta pisada y jamón. Manzana y unas almendras.' },
    { id: 'd-papa', title: 'Papa al horno con jamón + naranja', items: [i('papa-cruda', 400), i('jamon-cocido', 80), i('aceite', 8), i('naranja', 180)],
      recipe: 'Papa de la preparación, recalentada en sartén con unas gotas de aceite. Jamón y naranja.' },
  ],
  almuerzo: [
    { id: 'a-pollo-arroz', title: 'Pollo a la plancha con arroz y ensalada', items: [i('pollo-pechuga-cruda', 230), i('arroz-crudo', 130), i('lechuga', 50), i('tomate', 100), i('zanahoria', 50), i('aceite', 10)],
      recipe: 'Pollo a la plancha. Arroz hervido de la preparación. Ensalada con el aceite medido.' },
    { id: 'a-bowl-carne', title: 'Bowl de carne picada, arroz y morrón', items: [i('carne-picada-90', 200), i('arroz-crudo', 120), i('morron', 80), i('cebolla', 60), i('aceite', 8)],
      recipe: 'Salteá cebolla y morrón, sumá la carne. Serví sobre el arroz.' },
    { id: 'a-muslos-papa', title: 'Muslos de pollo con papa y calabaza al horno', items: [i('pollo-muslo-crudo', 250), i('papa-cruda', 550), i('zapallo', 150), i('aceite', 12)],
      recipe: 'Todo en una fuente con el aceite y especias, horno fuerte ~40 min.' },
    { id: 'a-carne-arroz', title: 'Carne a la plancha con arroz, chauchas y zanahoria', items: [i('carne-magra-cruda', 230), i('arroz-crudo', 130), i('chaucha', 100), i('zanahoria', 80), i('aceite', 10)],
      recipe: 'Carne a la plancha. Arroz de la preparación. Verduras al vapor con el aceite.' },
    { id: 'a-cerdo-batata', title: 'Solomillo de cerdo con batata y brócoli', items: [i('cerdo-solomillo-crudo', 230), i('batata-cruda', 600), i('brocoli', 120), i('aceite', 10)],
      recipe: 'Solomillo al horno o a la plancha. Batata al horno con el aceite. Brócoli al vapor.' },
    { id: 'a-hamburguesas', title: 'Hamburguesas caseras al pan con papas al horno', items: [i('carne-picada-90', 220), i('pan-frances', 90), i('lechuga', 30), i('tomate', 80), i('papa-cruda', 300), i('aceite', 6)],
      recipe: 'Dos hamburguesas caseras a la plancha, en pan con lechuga y tomate. Papas en gajos al horno.' },
    { id: 'a-parrilla-papa', title: 'Carne magra a la parrilla con papa y ensalada', items: [i('carne-magra-cruda', 230), i('papa-cruda', 650), i('lechuga', 60), i('tomate', 120), i('aceite', 10)],
      recipe: 'Peceto, nalga o cuadril desgrasado. Papa al rescoldo o hervida. Ensalada con el aceite.' },
    { id: 'a-fideos', title: 'Fideos con salsa boloñesa', items: [i('fideos-secos', 130), i('carne-picada-90', 190), i('tomate', 150), i('cebolla', 50), i('aceite', 8)],
      recipe: 'Salsa con cebolla, carne y tomate triturado. Fideos al dente.' },
    { id: 'a-milanesas', title: 'Milanesas de pollo al horno con puré rústico', items: [i('pollo-pechuga-cruda', 230), i('pan-rallado', 40), i('huevo', 25), i('aceite', 10), i('papa-cruda', 430), i('tomate', 100)],
      recipe: 'Pechugas fileteadas con medio huevo batido y pan rallado, al horno con el aceite pincelado. Papas hervidas y pisadas.',
      noEgg: { title: 'Milanesas de pollo al horno (rebozado con mostaza) con puré', items: [i('pollo-pechuga-cruda', 230), i('pan-rallado', 40), i('mostaza', 15), i('aceite', 10), i('papa-cruda', 430), i('tomate', 100)],
        recipe: 'Pincelá con mostaza en lugar de huevo y pasá por pan rallado. Resto igual.' } },
    { id: 'a-merluza-arroz', title: 'Merluza con arroz y zapallitos', items: [i('merluza-cruda', 280), i('arroz-crudo', 140), i('zapallito', 150), i('aceite', 12), i('limon-jugo', 10)],
      recipe: 'Merluza a la plancha o al horno con limón. Arroz y zapallitos salteados con el aceite.' },
    { id: 'a-lentejas', title: 'Guiso de lentejas con carne y arroz', items: [i('lentejas-cocidas', 220), i('carne-magra-cruda', 160), i('arroz-crudo', 80), i('zanahoria', 80), i('cebolla', 60), i('morron', 50), i('aceite', 8)],
      recipe: 'Rehogá cebolla y morrón, sumá carne en cubos, zanahoria, lentejas cocidas y arroz con caldo casero. Si las legumbres te hinchan, elegí otra opción.' },
  ],
  merienda: [
    { id: 'm-atun', title: 'Sándwich de atún + manzana y almendras', items: [i('pan-integral', 90), i('atun-al-natural', 80), i('tomate', 50), i('manzana', 180), i('almendras', 15)],
      recipe: 'Atún escurrido con tomate en pan integral. Manzana y un puñado chico de almendras.', dairyOption: { label: 'Sumar yogur natural', items: [i('yogur-natural-desc', 150)] } },
    { id: 'm-galletas-jamon', title: 'Galletas de arroz con jamón + banana y almendras', items: [i('galletas-arroz', 45), i('jamon-cocido', 80), i('banana', 120), i('almendras', 20)],
      recipe: '5 galletas de arroz con jamón. Banana y un puñado chico de almendras.' },
    { id: 'm-pollo', title: 'Sándwich de pollo + pera', items: [i('pan-frances', 100), i('pollo-pechuga-cruda', 100), i('lechuga', 20), i('tomate', 50), i('pera', 180)],
      recipe: 'Pollo ya cocido de la preparación, lechuga y tomate.' },
    { id: 'm-kiwi-nueces', title: 'Galletas de arroz con jamón + kiwi y nueces', items: [i('galletas-arroz', 54), i('jamon-cocido', 80), i('kiwi', 150), i('nueces', 15)],
      recipe: '6 galletas con jamón, 2 kiwis y un puñado chico de nueces.' },
    { id: 'm-pollo-palta', title: 'Sándwich integral de pollo y palta + manzana', items: [i('pan-integral', 90), i('pollo-pechuga-cruda', 100), i('palta', 40), i('manzana', 180)],
      recipe: 'Pollo ya cocido con palta pisada.', dairyOption: { label: 'Sumar ricota en el sándwich', items: [i('ricota-desc', 40)] } },
    { id: 'm-jamon', title: 'Sándwich de jamón + mandarinas y almendras', items: [i('pan-integral', 90), i('jamon-cocido', 80), i('tomate', 50), i('mandarina', 180), i('almendras', 15)],
      recipe: 'Sándwich simple. Dos mandarinas y unas almendras.', dairyOption: { label: 'Sumar yogur natural', items: [i('yogur-natural-desc', 150)] } },
    { id: 'm-atun-kiwi', title: 'Sándwich de atún + kiwi y almendras', items: [i('pan-integral', 90), i('atun-al-natural', 80), i('tomate', 50), i('kiwi', 150), i('almendras', 15)],
      recipe: 'Atún con tomate. Dos kiwis y unas almendras.' },
    { id: 'm-fruta-frutos', title: 'Banana, manzana y frutos secos con jamón', items: [i('banana', 120), i('manzana', 180), i('nueces', 25), i('jamon-cocido', 120)],
      recipe: 'Opción sin pan: fruta, un puñado de nueces y unas fetas de jamón.' },
  ],
  cena: [
    { id: 'c-bife', title: 'Bife de nalga con ensalada mixta y palta', items: [i('carne-magra-cruda', 250), i('lechuga', 80), i('tomate', 150), i('cebolla', 40), i('palta', 60), i('aceite', 12)],
      recipe: 'Bife a la plancha. Ensalada de lechuga, tomate, cebolla y palta con el aceite medido.' },
    { id: 'c-pollo', title: 'Pechuga grillada con ensalada de pepino, tomate y zanahoria', items: [i('pollo-pechuga-cruda', 280), i('lechuga', 60), i('tomate', 120), i('zanahoria', 60), i('pepino', 80), i('aceite', 15)],
      recipe: 'Pollo a la plancha con especias. Ensalada fresca con el aceite.' },
    { id: 'c-merluza', title: 'Merluza al horno con ensalada de espinaca, tomate y palta', items: [i('merluza-cruda', 320), i('espinaca', 60), i('tomate', 120), i('palta', 70), i('limon-jugo', 10), i('aceite', 14)],
      recipe: 'Merluza al horno con limón. Espinaca cruda, tomate y palta con el aceite.' },
    { id: 'c-cerdo', title: 'Solomillo de cerdo con ensalada de morrón, cebolla y palta', items: [i('cerdo-solomillo-crudo', 280), i('lechuga', 80), i('morron', 100), i('cebolla', 40), i('palta', 30), i('aceite', 15)],
      recipe: 'Solomillo a la plancha o al horno. Ensalada de lechuga con morrón, cebolla y palta.' },
    { id: 'c-hamburguesa', title: 'Hamburguesas caseras al plato con ensalada', items: [i('carne-picada-90', 230), i('lechuga', 60), i('tomate', 130), i('cebolla', 30), i('mostaza', 10), i('aceite', 12)],
      recipe: 'Dos hamburguesas caseras sin pan, con mostaza. Ensalada de lechuga, tomate y cebolla.' },
    { id: 'c-muslos', title: 'Muslos de pollo al horno con brócoli y zanahoria', items: [i('pollo-muslo-crudo', 280), i('brocoli', 150), i('zanahoria', 60), i('aceite', 15)],
      recipe: 'Muslos al horno con especias. Brócoli y zanahoria al vapor o salteados con el aceite.' },
    { id: 'c-atun', title: 'Ensalada completa de atún, palta y pepino', items: [i('atun-al-natural', 220), i('lechuga', 80), i('tomate', 150), i('pepino', 80), i('palta', 70), i('aceite', 14)],
      recipe: 'Ensalada grande con atún escurrido, palta en cubos y el aceite.' },
    { id: 'c-salteado', title: 'Salteado de carne con morrón, cebolla y zapallitos', items: [i('carne-magra-cruda', 250), i('morron', 100), i('cebolla', 60), i('zapallito', 150), i('aceite', 16)],
      recipe: 'Carne en tiras salteada a fuego fuerte con las verduras y el aceite.' },
  ],
};

const pick = (slot: MainSlot, id: string) => {
  const m = OPTIONS[slot].find((o) => o.id === id);
  if (!m) throw new Error(`Opción inexistente: ${slot}/${id}`);
  return m;
};

/** Sugerencia por día (1 = lunes … 7 = domingo). Cada comida se puede cambiar por otra opción. */
const PLAN: [string, string, string, string, string][] = [
  ['Lunes', 'd-jamon', 'a-pollo-arroz', 'm-atun', 'c-bife'],
  ['Martes', 'd-palta-pollo', 'a-bowl-carne', 'm-galletas-jamon', 'c-merluza'],
  ['Miércoles', 'd-revuelto', 'a-muslos-papa', 'm-pollo', 'c-hamburguesa'],
  ['Jueves', 'd-dulce', 'a-carne-arroz', 'm-kiwi-nueces', 'c-pollo'],
  ['Viernes', 'd-papa', 'a-cerdo-batata', 'm-pollo-palta', 'c-salteado'],
  ['Sábado', 'd-atun', 'a-hamburguesas', 'm-jamon', 'c-muslos'],
  ['Domingo', 'd-galletas', 'a-parrilla-papa', 'm-atun-kiwi', 'c-atun'],
];

export const MENU: MenuDay[] = PLAN.map(([name, d, a, m, c], idx) => ({
  day: idx + 1, name,
  meals: { desayuno: pick('desayuno', d), almuerzo: pick('almuerzo', a), merienda: pick('merienda', m), cena: pick('cena', c) },
}));

export function findOption(slot: MainSlot, id: string | undefined) {
  return id ? OPTIONS[slot].find((o) => o.id === id) : undefined;
}

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
