import type { FoodItem, MealSlot } from '../lib/types';

/**
 * Menú inicial. Cada comida tiene un grupo de opciones intercambiables con calorías y
 * proteína parecidas; cada día de la semana trae una opción sugerida y podés elegir otra.
 * Las cenas son sin carbohidratos (carne, pollo o pescado con ensaladas o verduras), por
 * pedido del usuario; el desayuno sigue su costumbre (bife y huevos duros, mate sin azúcar); los carbohidratos del día van en desayuno, almuerzo y merienda.
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
    { id: 'd-bife-huevos', title: 'Bife con 2 huevos duros, tostadas y naranja', items: [i('carne-magra-cruda', 110), i('huevo', 100), i('pan-frances', 100), i('tomate', 80), i('naranja', 180)],
      recipe: 'Bife a la plancha (o del día anterior). Huevos duros (10 min de hervor). Tostadas con tomate. Mate sin azúcar libre.',
      noEgg: { title: 'Bife con tostadas, tomate y naranja (sin huevo)', items: [i('carne-magra-cruda', 170), i('pan-frances', 100), i('tomate', 80), i('naranja', 180), i('almendras', 10)], recipe: 'Bife más grande en lugar de los huevos, y unas almendras.' } },
    { id: 'd-bife-banana', title: 'Bife con tostadas, banana y frutillas', items: [i('carne-magra-cruda', 160), i('pan-frances', 100), i('tomate', 80), i('banana', 120), i('frutillas', 100)],
      recipe: 'Bife a la plancha, tostadas con tomate, banana. Ideal antes del gimnasio.' },
    { id: 'd-sandwich-bife', title: 'Sándwich integral de bife con palta + manzana', items: [i('pan-integral', 120), i('carne-magra-cruda', 130), i('tomate', 60), i('lechuga', 20), i('palta', 40), i('manzana', 180)],
      recipe: 'Bife en tiras dentro del pan con palta, tomate y lechuga.' },
    { id: 'd-whey-tostadas', title: 'Whey en agua + tostadas con jamón y fruta', items: [i('whey', 30), i('pan-frances', 100), i('jamon-cocido', 60), i('banana', 120), i('frutillas', 150)],
      recipe: 'Un scoop de whey en agua fría. Tostadas con jamón. Banana y frutillas.' },
    { id: 'd-huevos-tostadas', title: 'Revuelto de 2 huevos con jamón, palta y banana', items: [i('huevo', 100), i('jamon-cocido', 60), i('pan-integral', 100), i('palta', 40), i('banana', 120)],
      recipe: 'Revuelto en sartén antiadherente con el jamón. Tostadas integrales con palta.',
      noEgg: { title: 'Tostadas integrales con jamón y palta + banana (sin huevo)', items: [i('jamon-cocido', 120), i('pan-integral', 110), i('palta', 60), i('banana', 120)], recipe: 'Más jamón en lugar del huevo.' } },
    { id: 'd-pollo-papa', title: 'Muslo de pollo con papas + mandarina', items: [i('pollo-muslo-crudo', 160), i('papa-cruda', 380), i('aceite', 5), i('mandarina', 180)],
      recipe: 'Muslo y papas de la preparación (horno). Se recalienta en 2 minutos.' },
    { id: 'd-cerdo-batata', title: 'Solomillo de cerdo con batata + naranja', items: [i('cerdo-solomillo-crudo', 160), i('batata-cruda', 360), i('aceite', 5), i('naranja', 180)],
      recipe: 'Cerdo y batata al horno de la preparación.' },
    { id: 'd-picada-huevo', title: 'Carne picada salteada con 1 huevo, tostadas y mandarina', items: [i('carne-picada-90', 130), i('huevo', 50), i('pan-frances', 100), i('tomate', 100), i('mandarina', 90)],
      recipe: 'Carne picada salteada con tomate y un huevo revuelto. Tostadas.',
      noEgg: { title: 'Carne picada salteada con tomate, tostadas y mandarina (sin huevo)', items: [i('carne-picada-90', 160), i('pan-frances', 100), i('tomate', 100), i('mandarina', 90)], recipe: 'Igual, sin el huevo y con un poco más de carne.' } },
  ],
  almuerzo: [
    { id: 'a-bife-arroz', title: 'Bife con arroz y ensalada de lechuga, tomate y zanahoria', items: [i('carne-magra-cruda', 190), i('arroz-crudo', 110), i('lechuga', 50), i('tomate', 100), i('zanahoria', 80), i('aceite', 10)],
      recipe: 'Bife a la plancha. Arroz blanco hervido. Ensalada con el aceite medido.' },
    { id: 'a-muslo-papa', title: 'Muslos de pollo al horno con papas y calabaza', items: [i('pollo-muslo-crudo', 230), i('papa-cruda', 500), i('zapallo', 100), i('aceite', 10)],
      recipe: 'Muslos sin piel con pimentón, ajo y limón (quedan jugosos). Todo en una fuente, horno fuerte 40 min.' },
    { id: 'a-cerdo-batata', title: 'Solomillo de cerdo con batata y brócoli', items: [i('cerdo-solomillo-crudo', 190), i('batata-cruda', 500), i('brocoli', 120), i('aceite', 10)],
      recipe: 'Solomillo al horno (20 min) para que quede jugoso. Batata al horno. Brócoli al vapor.' },
    { id: 'a-merluza-arroz', title: 'Merluza con arroz y zapallitos', items: [i('merluza-cruda', 250), i('arroz-crudo', 120), i('zapallito', 150), i('aceite', 12), i('limon-jugo', 10)],
      recipe: 'Merluza al horno con limón. Arroz y zapallitos salteados con el aceite.' },
    { id: 'a-fideos', title: 'Fideos con boloñesa casera', items: [i('fideos-secos', 110), i('carne-picada-90', 170), i('tomate', 150), i('cebolla', 50), i('aceite', 6)],
      recipe: 'Salsa con cebolla, carne y tomate triturado. Fideos al dente.' },
    { id: 'a-lentejas', title: 'Guiso de lentejas con carne y arroz', items: [i('lentejas-cocidas', 250), i('carne-magra-cruda', 120), i('arroz-crudo', 50), i('zanahoria', 80), i('cebolla', 60), i('morron', 50), i('aceite', 8)],
      recipe: 'Rehogá cebolla y morrón, sumá carne en cubos, zanahoria, lentejas cocidas y arroz con caldo casero.' },
    { id: 'a-hamburguesa', title: 'Hamburguesas caseras al pan con papas al horno', items: [i('carne-picada-90', 200), i('pan-frances', 90), i('lechuga', 30), i('tomate', 80), i('papa-cruda', 200), i('aceite', 6)],
      recipe: 'Dos hamburguesas caseras a la plancha, en pan. Papas en gajos al horno.' },
    { id: 'a-milanesa', title: 'Milanesas de carne al horno con puré', items: [i('carne-magra-cruda', 170), i('pan-rallado', 40), i('huevo', 25), i('aceite', 8), i('papa-cruda', 400)],
      recipe: 'Milanesas de nalga pasadas por medio huevo y pan rallado, al horno pinceladas con el aceite. Puré de papa con agua de cocción.',
      noEgg: { title: 'Milanesas de carne al horno (rebozado con mostaza) con puré', items: [i('carne-magra-cruda', 170), i('pan-rallado', 40), i('mostaza', 15), i('aceite', 8), i('papa-cruda', 430)],
        recipe: 'Pincelá la carne con mostaza en lugar de huevo. Resto igual.' } },
    { id: 'a-carre-arroz', title: 'Carré de cerdo con arroz, chauchas y zanahoria', items: [i('cerdo-carre-crudo', 200), i('arroz-crudo', 105), i('chaucha', 100), i('zanahoria', 60), i('aceite', 6)],
      recipe: 'Carré a la plancha o al horno. Arroz y verduras al vapor.' },
  ],
  merienda: [
    { id: 'm-whey-banana', title: 'Whey en agua + banana, galletas de arroz y almendras', items: [i('whey', 30), i('banana', 120), i('galletas-arroz', 27), i('almendras', 15)],
      recipe: 'Un scoop de whey en agua fría. 3 galletas de arroz, banana y un puñado chico de almendras.' },
    { id: 'm-whey-sandwich', title: 'Whey en agua + sándwich integral de jamón + manzana', items: [i('whey', 30), i('pan-integral', 70), i('jamon-cocido', 50), i('manzana', 180)],
      recipe: 'Whey en agua. Sándwich simple de jamón.' },
    { id: 'm-jamon', title: 'Sándwich integral de jamón y tomate + mandarinas', items: [i('pan-integral', 90), i('jamon-cocido', 100), i('tomate', 50), i('mandarina', 180)],
      recipe: 'Sándwich de jamón y tomate. Dos mandarinas. Opción sin whey.' },
    { id: 'm-whey-nueces', title: 'Whey en agua + pera, nueces y galletas', items: [i('whey', 35), i('pera', 180), i('nueces', 20), i('galletas-arroz', 18)],
      recipe: 'Whey en agua, una pera, un puñado chico de nueces y 2 galletas de arroz.' },
    { id: 'm-pollo', title: 'Sándwich de pollo jugoso + banana', items: [i('pan-frances', 80), i('pollo-muslo-crudo', 110), i('tomate', 50), i('banana', 120)],
      recipe: 'Muslo al horno desmenuzado de la preparación, con tomate.' },
    { id: 'm-batido', title: 'Licuado de whey con banana y frutillas (con agua) + galletas', items: [i('whey', 30), i('banana', 120), i('frutillas', 200), i('galletas-arroz', 18), i('almendras', 15)],
      recipe: 'Licuá whey, banana y frutillas con agua y hielo. 2 galletas de arroz y unas almendras.' },
  ],
  cena: [
    { id: 'c-bife', title: 'Bife con ensalada mixta y palta', items: [i('carne-magra-cruda', 210), i('lechuga', 80), i('tomate', 200), i('cebolla', 40), i('palta', 80), i('aceite', 12)],
      recipe: 'Bife a la plancha. Ensalada de lechuga, tomate, cebolla y palta con el aceite medido.' },
    { id: 'c-muslo', title: 'Muslos de pollo al horno con brócoli y zanahoria', items: [i('pollo-muslo-crudo', 240), i('brocoli', 200), i('zanahoria', 80), i('aceite', 19)],
      recipe: 'Muslos al horno con especias (jugosos). Brócoli y zanahoria al vapor o salteados con el aceite.' },
    { id: 'c-merluza', title: 'Merluza al horno con ensalada de espinaca, tomate y palta', items: [i('merluza-cruda', 280), i('espinaca', 80), i('tomate', 120), i('palta', 90), i('limon-jugo', 10), i('aceite', 14)],
      recipe: 'Merluza al horno con limón. Espinaca cruda, tomate y palta con el aceite.' },
    { id: 'c-cerdo', title: 'Solomillo de cerdo con ensalada de rúcula, tomate y palta', items: [i('cerdo-solomillo-crudo', 240), i('rucula', 80), i('tomate', 120), i('cebolla', 40), i('palta', 60), i('aceite', 14)],
      recipe: 'Solomillo a la plancha o al horno. Ensalada de rúcula, tomate, cebolla y palta.' },
    { id: 'c-hamburguesa', title: 'Hamburguesas caseras al plato con ensalada', items: [i('carne-picada-90', 240), i('lechuga', 80), i('tomate', 180), i('cebolla', 30), i('pepino', 80), i('mostaza', 10), i('aceite', 10)],
      recipe: 'Dos hamburguesas caseras sin pan, con mostaza. Ensalada de lechuga, tomate y cebolla.' },
    { id: 'c-salteado', title: 'Salteado de carne con morrón, cebolla y zapallitos', items: [i('carne-magra-cruda', 220), i('morron', 150), i('cebolla', 60), i('zapallito', 200), i('aceite', 18)],
      recipe: 'Carne en tiras salteada a fuego fuerte con las verduras y el aceite.' },
    { id: 'c-carre', title: 'Carré de cerdo con ensalada de repollo, zanahoria y palta', items: [i('cerdo-carre-crudo', 230), i('repollo', 150), i('zanahoria', 60), i('palta', 50), i('aceite', 12)],
      recipe: 'Carré a la plancha. Repollo y zanahoria rallados con palta y el aceite.' },
    { id: 'c-pollo-ensalada', title: 'Muslo de pollo con ensalada completa', items: [i('pollo-muslo-crudo', 240), i('lechuga', 60), i('tomate', 160), i('pepino', 80), i('palta', 70), i('aceite', 12)],
      recipe: 'Muslo al horno o a la plancha. Ensalada de lechuga, tomate, pepino y palta.' },
  ],
};

const pick = (slot: MainSlot, id: string) => {
  const m = OPTIONS[slot].find((o) => o.id === id);
  if (!m) throw new Error(`Opción inexistente: ${slot}/${id}`);
  return m;
};

/** Sugerencia por día (1 = lunes … 7 = domingo). Cada comida se puede cambiar por otra opción. */
const PLAN: [string, string, string, string, string][] = [
  ['Lunes', 'd-bife-huevos', 'a-bife-arroz', 'm-whey-banana', 'c-muslo'],
  ['Martes', 'd-whey-tostadas', 'a-muslo-papa', 'm-jamon', 'c-merluza'],
  ['Miércoles', 'd-bife-huevos', 'a-lentejas', 'm-batido', 'c-cerdo'],
  ['Jueves', 'd-sandwich-bife', 'a-merluza-arroz', 'm-whey-sandwich', 'c-bife'],
  ['Viernes', 'd-bife-huevos', 'a-fideos', 'm-pollo', 'c-hamburguesa'],
  ['Sábado', 'd-pollo-papa', 'a-hamburguesa', 'm-whey-nueces', 'c-salteado'],
  ['Domingo', 'd-cerdo-batata', 'a-milanesa', 'm-whey-banana', 'c-carre'],
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
