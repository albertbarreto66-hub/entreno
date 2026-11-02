import type { DayTemplate, ExerciseTemplate } from '../lib/types';

/**
 * Programa de 5 días (lunes a viernes), máximo ~60 minutos por sesión.
 * Distribución híbrida torso / pierna: torso 3 veces (lun, mié, vie) para priorizar hombros,
 * pecho superior, espalda ancha y brazos; pierna 2 veces (mar, jue) con volumen moderado,
 * en máquinas y sin aguantar la respiración (antecedentes venosos).
 * Las series de cada ejercicio son las "base": el bloque del programa las ajusta (ver program.ts).
 */
type Ex = Omit<ExerciseTemplate, 'restSec' | 'incrementKg'> & { restSec?: [number, number]; incrementKg?: number };
const MAIN: [number, number] = [120, 150];
const ACC: [number, number] = [60, 90];

function ex(e: Ex): ExerciseTemplate {
  return { restSec: e.main ? MAIN : ACC, incrementKg: e.main ? 2.5 : 1, ...e };
}

const VEINS = 'Carga moderada, exhalá al empujar (no aguantes la respiración) y frená si aparece dolor, pesadez o hinchazón en las piernas.';
const WRIST = 'Si molesta la muñeca, usá agarre neutro o el que te resulte cómodo.';

export const DEFAULT_TEMPLATES: DayTemplate[] = [
  {
    id: 'lunes', weekday: 1, name: 'Torso A · Pecho superior y hombros', exercises: [
      ex({ id: 'l-press-inclinado-maq', name: 'Press inclinado en máquina', muscle: 'Pecho superior, hombro anterior, tríceps', alternative: 'Press inclinado con mancuernas', sets: 3, repMin: 6, repMax: 10, main: true, priority: true,
        video: 'press inclinado en máquina técnica correcta',
        how: 'Asiento para que los agarres queden a la altura de la parte alta del pecho. Escápulas juntas y apoyadas, bajá controlado 2 segundos y empujá sin bloquear los codos de golpe.',
        errors: 'Despegar los hombros del respaldo, rebotar abajo, abrir los codos a 90°.', caution: WRIST }),
      ex({ id: 'l-jalon-ancho', name: 'Jalón al pecho agarre ancho', muscle: 'Dorsal ancho (espalda en V)', alternative: 'Jalón en máquina convergente', sets: 3, repMin: 8, repMax: 12, main: true, priority: true,
        video: 'jalón al pecho técnica correcta dorsales',
        how: 'Muslos trabados, pecho alto. Llevá la barra a la parte alta del pecho pensando en bajar los codos hacia los bolsillos. Subí controlando hasta estirar.',
        errors: 'Tirarte para atrás, tirar con los brazos, bajar la barra detrás de la nuca.' }),
      ex({ id: 'l-press-plano-maq', name: 'Press de pecho en máquina', muscle: 'Pecho medio, tríceps', alternative: 'Press plano con mancuernas', sets: 2, repMin: 8, repMax: 12, main: false,
        video: 'press de pecho en máquina técnica',
        how: 'Agarres a la altura media del pecho, escápulas apoyadas, empujá y volvé lento.', errors: 'Rebotar, despegar los hombros.', caution: WRIST, incrementKg: 2.5 }),
      ex({ id: 'l-remo-sentado', name: 'Remo sentado en polea agarre neutro', muscle: 'Espalda media, dorsal', alternative: 'Remo en máquina con pecho apoyado', sets: 3, repMin: 8, repMax: 12, main: false, priority: true,
        video: 'remo sentado en polea técnica correcta',
        how: 'Torso erguido y quieto. Llevá el agarre al abdomen juntando escápulas; volvé estirando sin redondear la espalda.',
        errors: 'Balancearte, encoger los hombros, redondear la espalda al estirar.', incrementKg: 2.5 }),
      ex({ id: 'l-laterales-polea', name: 'Elevaciones laterales en polea', muscle: 'Hombro lateral (ancho de hombros)', alternative: 'Elevaciones laterales con mancuernas', sets: 3, repMin: 12, repMax: 20, main: false, priority: true,
        video: 'elevaciones laterales en polea técnica',
        how: 'Polea baja del lado contrario. Subí el brazo hacia el costado hasta la altura del hombro, codo apenas flexionado, bajada lenta.',
        errors: 'Encoger el hombro, balancear el cuerpo, subir por encima del hombro.' }),
      ex({ id: 'l-triceps-cuerda', name: 'Tríceps en polea con cuerda', muscle: 'Tríceps', alternative: 'Tríceps en polea con barra', sets: 2, repMin: 10, repMax: 15, main: false,
        video: 'extensión de tríceps en polea con cuerda técnica',
        how: 'Codos pegados al cuerpo, extendé y separá la cuerda abajo, volvé controlando.', errors: 'Mover los codos, inclinarte encima de la polea.', caution: WRIST }),
    ],
  },
  {
    id: 'martes', weekday: 2, name: 'Pierna A · Cuádriceps y glúteo', exercises: [
      ex({ id: 'm-prensa', name: 'Prensa 45°', muscle: 'Cuádriceps, glúteo', alternative: 'Prensa horizontal', sets: 3, repMin: 8, repMax: 12, main: true, incrementKg: 5,
        video: 'prensa 45 grados técnica correcta',
        how: 'Pies a la altura de los hombros, rodillas en la línea de los pies. Bajá hasta donde la zona lumbar siga apoyada. Exhalá al empujar.',
        errors: 'Despegar la cadera abajo, rodillas hacia adentro, bloquear las rodillas, aguantar la respiración.', caution: VEINS }),
      ex({ id: 'm-hip-thrust', name: 'Hip thrust en máquina', muscle: 'Glúteo', alternative: 'Hip thrust con barra en banco', sets: 3, repMin: 8, repMax: 12, main: true,
        video: 'hip thrust en máquina técnica',
        how: 'Espalda alta apoyada, pies firmes. Empujá con la cadera hasta quedar alineado, pausa de 1 segundo arriba, exhalá al subir.',
        errors: 'Arquear la zona lumbar en lugar de extender la cadera.', caution: VEINS }),
      ex({ id: 'm-extension-cuad', name: 'Extensión de cuádriceps', muscle: 'Cuádriceps', alternative: 'Sentadilla en máquina hack (liviana)', sets: 3, repMin: 10, repMax: 15, main: false,
        video: 'extensión de cuádriceps en máquina técnica',
        how: 'Rodilla alineada con el eje de la máquina. Extendé completo, pausa arriba, bajá lento.', errors: 'Patear con impulso, levantar la cadera del asiento.' }),
      ex({ id: 'm-femoral-sentado', name: 'Curl femoral sentado', muscle: 'Isquiotibiales', alternative: 'Curl femoral acostado', sets: 3, repMin: 10, repMax: 12, main: false,
        video: 'curl femoral sentado técnica',
        how: 'Rodillo sobre los tobillos y rodilla alineada con el eje. Flexioná completo y volvé en 2 segundos.', errors: 'Levantar la cadera, recorrido corto.' }),
      ex({ id: 'm-gemelos', name: 'Gemelos sentado en máquina', muscle: 'Pantorrillas', alternative: 'Gemelos de pie en máquina', sets: 3, repMin: 12, repMax: 15, main: false,
        video: 'gemelos sentado en máquina técnica',
        how: 'Subí lo más alto posible, pausa, y bajá hasta estirar.', errors: 'Rebotar, recorrido corto.' }),
      ex({ id: 'm-pallof', name: 'Pallof press', muscle: 'Core (antirrotación)', alternative: 'Plancha frontal', sets: 2, repMin: 10, repMax: 12, perSide: true, main: false,
        video: 'pallof press técnica',
        how: 'De costado a la polea, llevá el agarre al frente del pecho y estirá los brazos resistiendo el giro. Respirá normal.',
        errors: 'Girar el torso, contener la respiración.' }),
    ],
  },
  {
    id: 'miercoles', weekday: 3, name: 'Torso B · Espalda ancha y bíceps', exercises: [
      ex({ id: 'x-jalon-neutro', name: 'Jalón agarre neutro cerrado', muscle: 'Dorsal ancho', alternative: 'Dominadas asistidas en máquina', sets: 3, repMin: 6, repMax: 10, main: true, priority: true,
        video: 'jalón agarre neutro cerrado técnica',
        how: 'Pecho alto, bajá llevando los codos hacia las costillas. Pausa abajo, subí controlando.', errors: 'Balancearte, recorrido corto arriba.' }),
      ex({ id: 'x-remo-apoyado', name: 'Remo con pecho apoyado en máquina', muscle: 'Espalda alta y media', alternative: 'Remo en T con apoyo', sets: 3, repMin: 8, repMax: 10, main: true, priority: true,
        video: 'remo con pecho apoyado en máquina técnica',
        how: 'Pecho firme contra el apoyo. Codos atrás y abajo, juntá escápulas, volvé despacio.', errors: 'Despegar el pecho, encoger los hombros.', caution: WRIST }),
      ex({ id: 'x-press-hombro', name: 'Press de hombro en máquina', muscle: 'Hombro anterior y lateral', alternative: 'Press de hombro con mancuernas sentado', sets: 3, repMin: 8, repMax: 12, main: false, priority: true, incrementKg: 2.5,
        video: 'press de hombro en máquina técnica',
        how: 'Espalda apoyada, empujá hacia arriba sin bloquear de golpe, bajá hasta la altura de las orejas.', errors: 'Arquear la zona lumbar, recorrido corto.', caution: WRIST }),
      ex({ id: 'x-pullover-polea', name: 'Pullover en polea alta', muscle: 'Dorsal ancho', alternative: 'Pullover con mancuerna', sets: 2, repMin: 12, repMax: 15, main: false,
        video: 'pullover en polea alta dorsales técnica',
        how: 'Brazos casi estirados, llevá la barra o cuerda desde arriba hasta los muslos con el dorsal. Volvé lento.', errors: 'Doblar los codos y convertirlo en tríceps, balancearte.' }),
      ex({ id: 'x-face-pull', name: 'Face pull', muscle: 'Hombro posterior, postura', alternative: 'Pájaro en máquina (hombro posterior)', sets: 2, repMin: 12, repMax: 15, main: false,
        video: 'face pull técnica correcta',
        how: 'Polea a la altura de la cara. Tirá la cuerda hacia la frente separando las manos y rotando hacia afuera.', errors: 'Tirar con la espalda baja, usar demasiado peso.' }),
      ex({ id: 'x-curl-inclinado', name: 'Curl de bíceps en banco inclinado', muscle: 'Bíceps', alternative: 'Curl en polea baja', sets: 3, repMin: 8, repMax: 12, main: false, priority: true,
        video: 'curl de bíceps en banco inclinado técnica',
        how: 'Banco a 45-60°, brazos colgando. Subí sin mover el codo y bajá lento hasta estirar.', errors: 'Adelantar los codos, balancear.', caution: WRIST }),
    ],
  },
  {
    id: 'jueves', weekday: 4, name: 'Pierna B · Femorales, glúteo y core', exercises: [
      ex({ id: 'j-rumano', name: 'Peso muerto rumano con mancuernas', muscle: 'Isquiotibiales, glúteo', alternative: 'Hiperextensiones 45° para glúteo', sets: 3, repMin: 8, repMax: 10, main: true,
        video: 'peso muerto rumano con mancuernas técnica',
        how: 'Rodillas apenas flexionadas. Llevá la cadera atrás con la espalda neutra y las mancuernas pegadas a las piernas. Subí empujando la cadera adelante. Exhalá al subir.',
        errors: 'Redondear la espalda, bajar más de lo que tu movilidad permite, convertirlo en sentadilla.', caution: VEINS }),
      ex({ id: 'j-prensa-alta', name: 'Prensa con pies altos', muscle: 'Glúteo, isquiotibiales', alternative: 'Sentadilla búlgara asistida', sets: 3, repMin: 10, repMax: 12, main: false, incrementKg: 5,
        video: 'prensa pies altos glúteo técnica',
        how: 'Pies en la parte alta de la plataforma, más separados. Bajá controlado y empujá con los talones.', errors: 'Despegar la cadera, aguantar la respiración.', caution: VEINS }),
      ex({ id: 'j-femoral-acostado', name: 'Curl femoral acostado', muscle: 'Isquiotibiales', alternative: 'Curl femoral sentado', sets: 3, repMin: 10, repMax: 12, main: false,
        video: 'curl femoral acostado técnica',
        how: 'Cadera pegada al banco. Flexioná completo y bajá en 2 segundos.', errors: 'Levantar la cadera, usar impulso.' }),
      ex({ id: 'j-abduccion', name: 'Abducción de cadera en máquina', muscle: 'Glúteo medio', alternative: 'Abducción con banda', sets: 2, repMin: 12, repMax: 15, main: false,
        video: 'abducción de cadera en máquina técnica',
        how: 'Espalda apoyada, abrí las piernas controlando y volvé sin dejar caer el peso.', errors: 'Usar impulso, recorrido mínimo.' }),
      ex({ id: 'j-extension-cuad', name: 'Extensión de cuádriceps', muscle: 'Cuádriceps', alternative: 'Prensa con pies bajos (liviana)', sets: 2, repMin: 12, repMax: 15, main: false,
        video: 'extensión de cuádriceps en máquina técnica',
        how: 'Extendé completo, pausa arriba, bajá lento.', errors: 'Patear con impulso.' }),
      ex({ id: 'j-crunch-polea', name: 'Crunch en polea', muscle: 'Recto abdominal', alternative: 'Crunch en máquina', sets: 3, repMin: 10, repMax: 15, main: false,
        video: 'crunch en polea alta técnica',
        how: 'De rodillas frente a la polea, flexioná la columna llevando los codos hacia los muslos. Exhalá al bajar.',
        errors: 'Tirar con los brazos, mover la cadera en vez de la columna. (Entrena el músculo: no quema la grasa de la panza en particular.)' }),
    ],
  },
  {
    id: 'viernes', weekday: 5, name: 'Torso C · Hombros, pecho superior y brazos', exercises: [
      ex({ id: 'v-press-inclinado-manc', name: 'Press inclinado con mancuernas', muscle: 'Pecho superior', alternative: 'Press inclinado en Smith', sets: 3, repMin: 8, repMax: 10, main: true, priority: true, incrementKg: 2,
        video: 'press inclinado con mancuernas técnica correcta',
        how: 'Banco a 30°. Bajá las mancuernas a los costados del pecho con los codos a 45°, empujá hacia arriba y levemente adentro.',
        errors: 'Banco demasiado inclinado, arquear mucho la espalda, chocar las mancuernas.', caution: WRIST }),
      ex({ id: 'v-remo-maq-ancho', name: 'Remo en máquina agarre ancho', muscle: 'Espalda alta, hombro posterior', alternative: 'Remo sentado en polea con barra ancha', sets: 3, repMin: 8, repMax: 12, main: false, priority: true, incrementKg: 2.5,
        video: 'remo en máquina agarre ancho técnica',
        how: 'Codos abiertos a la altura del pecho, tirá juntando escápulas, volvé lento.', errors: 'Encoger los hombros, tirar con impulso.' }),
      ex({ id: 'v-laterales-maq', name: 'Elevaciones laterales en máquina', muscle: 'Hombro lateral', alternative: 'Elevaciones laterales con mancuernas', sets: 3, repMin: 12, repMax: 20, main: false, priority: true,
        video: 'elevaciones laterales en máquina técnica',
        how: 'Codos apoyados en las almohadillas, subí hasta la altura de los hombros, bajada lenta.', errors: 'Encoger los hombros, balancear.' }),
      ex({ id: 'v-cruce-bajo-alto', name: 'Cruce de poleas de abajo hacia arriba', muscle: 'Pecho superior', alternative: 'Pec deck', sets: 2, repMin: 12, repMax: 15, main: false,
        video: 'cruce de poleas de abajo hacia arriba pecho superior',
        how: 'Poleas bajas, llevá las manos hacia arriba y al centro a la altura del mentón, apretando el pecho.', errors: 'Doblar mucho los codos, usar demasiado peso.' }),
      ex({ id: 'v-curl-martillo', name: 'Curl martillo con mancuernas', muscle: 'Bíceps, braquial, antebrazo', alternative: 'Curl martillo en polea con cuerda', sets: 3, repMin: 10, repMax: 12, main: false, priority: true,
        video: 'curl martillo con mancuernas técnica',
        how: 'Agarre neutro, codos quietos al costado, subí y bajá controlando.', errors: 'Balancear, adelantar los codos.', caution: WRIST }),
      ex({ id: 'v-triceps-cabeza', name: 'Extensión de tríceps sobre la cabeza en polea', muscle: 'Tríceps (cabeza larga)', alternative: 'Extensión de tríceps con mancuerna sobre la cabeza', sets: 3, repMin: 10, repMax: 15, main: false, priority: true,
        video: 'extensión de tríceps sobre la cabeza en polea técnica',
        how: 'De espaldas a la polea, codos apuntando adelante. Extendé completo y volvé estirando.', errors: 'Abrir los codos, arquear la espalda.', caution: WRIST }),
    ],
  },
];

export const PRECHECK_TEXT =
  'Antes de entrenar: si sentís falta de aire fuera de lo habitual, dolor de pecho, mareo o pesadez fuerte en las piernas, no hagas series pesadas ese día. ' +
  'Si usás inhalador o medias de compresión, seguí lo que te indicó tu médico. No aguantes la respiración al empujar.';

/** Link de búsqueda en YouTube para ver la técnica (no es un video elegido a mano). */
export function videoUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
