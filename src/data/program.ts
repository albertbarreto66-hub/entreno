/**
 * Plan de 24 semanas en 6 bloques de 4 semanas.
 * Las semanas de descarga bajan volumen y carga para recuperar; no son "semanas perdidas".
 * Los números de pasos son metas máximas de referencia: la app solo sugiere subir si hubo
 * cumplimiento, sin dolor y con buena recuperación.
 */
export interface Block {
  n: number;
  name: string;
  weeks: [number, number];
  goal: string;
  setsDelta: number; // series extra (o menos) sobre las "base" de la plantilla
  priorityExtra: number; // series extra solo para ejercicios prioritarios
  rir: number; // repeticiones en reserva objetivo
  deloadWeek?: number; // semana de descarga dentro del bloque
  steps: string;
  nutrition: string;
  recovery: string;
  indicators: string;
  modify: string;
}

export const BLOCKS: Block[] = [
  { n: 1, name: 'Adaptación y técnica', weeks: [1, 4], goal: 'Aprender los ejercicios, calibrar cargas y crear el hábito sin dolores.',
    setsDelta: -1, priorityExtra: 0, rir: 3,
    steps: 'Arrancá en tu promedio actual (≈ 10.000–11.000). Subí 500 por semana solo si cumpliste 5 de 7 días sin dolor.',
    nutrition: 'Déficit moderado con el menú (≈ 2.450 kcal, ≈ 185 g de proteína). Prioridad: cumplir las 4 comidas y pesar porciones.',
    recovery: 'Acostarte 30 minutos antes cada semana hasta llegar a las 00:00. Dormir al menos 7 h.',
    indicators: 'Técnica estable, sin dolor articular, cargas registradas en todos los ejercicios.',
    modify: 'Si terminás muy fatigado o con dolor, mantené las series del bloque y no subas cargas esa semana.' },
  { n: 2, name: 'Acumulación', weeks: [5, 8], goal: 'Subir cargas o repeticiones semana a semana con el volumen base.',
    setsDelta: 0, priorityExtra: 0, rir: 2,
    steps: 'Seguí con +500 por semana si se cumple la revisión semanal, hasta 13.000–14.000.',
    nutrition: 'Mismo plan. Ajustes según el control semanal (ver criterios).',
    recovery: 'Objetivo: 7–8 h. Si dormís menos de 6 h, ese día no subas cargas.',
    indicators: 'Cargas o repeticiones en subida en la mayoría de los ejercicios; cintura bajando.',
    modify: 'Si el rendimiento cae 2 sesiones seguidas en varios ejercicios, repetí la semana.' },
  { n: 3, name: 'Hipertrofia +', weeks: [9, 12], goal: 'Más volumen en hombros, pecho superior, espalda y brazos.',
    setsDelta: 0, priorityExtra: 1, rir: 2, deloadWeek: 12,
    steps: 'Hasta 15.000 si se cumple la revisión. Semana 12: mantené los pasos sin subir.',
    nutrition: 'Semana 12: comé en mantenimiento estimado (+300–400 kcal, sobre todo carbohidratos en almuerzo y merienda) para recuperar.',
    recovery: 'Semana 12 de descarga: mitad de series y cargas un 10 % más bajas.',
    indicators: 'Fuerza estable o en subida con el volumen extra; hambre controlable.',
    modify: 'Si la recuperación es mala dos semanas seguidas, quitá la serie extra antes de la descarga.' },
  { n: 4, name: 'Fuerza-hipertrofia', weeks: [13, 16], goal: 'Consolidar fuerza en los ejercicios principales con el volumen base.',
    setsDelta: 0, priorityExtra: 0, rir: 2,
    steps: 'Mantener 15.000 si te recuperás bien; no subir más.',
    nutrition: 'Volvé al déficit del plan. Ajustes según el control semanal.',
    recovery: '7–8 h de sueño. Un día de recuperación extra si aparece fatiga acumulada.',
    indicators: 'Récords de carga en los ejercicios principales; cintura y peso promedio bajando.',
    modify: 'Si no hay cambios en cintura ni peso durante 2–3 semanas con buena adherencia, aplicá el criterio de ajuste.' },
  { n: 5, name: 'Volumen máximo tolerable', weeks: [17, 20], goal: 'Último empuje de volumen en grupos prioritarios.',
    setsDelta: 0, priorityExtra: 1, rir: 2,
    steps: 'Mantener 15.000 (tope de la plantilla 20.000; no hace falta llegar).',
    nutrition: 'Mismo plan. No bajes más calorías si el rendimiento cae: primero revisá sueño y adherencia.',
    recovery: 'Vigilá señales de fatiga (ver Recuperación).',
    indicators: 'Repeticiones en subida con la serie extra; buena energía.',
    modify: 'Si aparecen dolores o el sueño empeora, volvé al volumen base.' },
  { n: 6, name: 'Consolidación y reevaluación', weeks: [21, 24], goal: 'Mantener lo ganado, reevaluar fotos y medidas y decidir la etapa siguiente.',
    setsDelta: 0, priorityExtra: 0, rir: 2, deloadWeek: 24,
    steps: 'Mantener la meta que toleres.',
    nutrition: 'Semana 24: mantenimiento estimado. Después: seguir en déficit si la cintura todavía está alta, o pasar a mantenimiento y desarrollo muscular.',
    recovery: 'Semana 24 de descarga.',
    indicators: 'Comparación de fotos (semana 1 vs 24), cintura, pecho, bíceps y cargas.',
    modify: 'Con los datos de 24 semanas se arma la etapa siguiente.' },
];

export const PROGRAM_WEEKS = 24;

export function blockForWeek(week: number): Block {
  const w = Math.min(Math.max(1, week), PROGRAM_WEEKS);
  return BLOCKS.find((b) => w >= b.weeks[0] && w <= b.weeks[1]) ?? BLOCKS[BLOCKS.length - 1];
}

export function isDeloadWeek(week: number) {
  return blockForWeek(week).deloadWeek === week;
}
