import type { DayTemplate, ExerciseTemplate } from '../lib/types';

type Ex = Omit<ExerciseTemplate, 'restSec' | 'incrementKg'> & { restSec?: [number, number]; incrementKg?: number };
const MAIN: [number, number] = [120, 180];
const ACC: [number, number] = [60, 90];

function ex(e: Ex): ExerciseTemplate {
  return { restSec: e.main ? MAIN : ACC, incrementKg: e.main ? 2.5 : 1, ...e };
}

const KNEE = 'Solo si la rodilla está estable y sin dolor. Si no, omitilo y registrá el motivo; que tu entrenador decida la adaptación.';
const WRIST = 'Si molesta la muñeca, usá agarre neutro o el que te resulte cómodo, o bajá la carga.';

export const DEFAULT_TEMPLATES: DayTemplate[] = [
  {
    id: 'lunes', weekday: 1, name: 'Torso A', exercises: [
      ex({ id: 'lun-press-pecho', name: 'Press de pecho en máquina', alternative: 'Press con mancuernas en banco plano', sets: 3, repMin: 6, repMax: 8, main: true,
        how: 'Ajustá el asiento para que los agarres queden a la altura media del pecho. Escápulas apoyadas, empujá sin bloquear los codos de golpe y bajá controlando.',
        errors: 'Despegar los hombros del respaldo, rebotar abajo, abrir demasiado los codos.', caution: WRIST }),
      ex({ id: 'lun-remo-apoyado', name: 'Remo con pecho apoyado', alternative: 'Remo en máquina', sets: 3, repMin: 6, repMax: 8, main: true,
        how: 'Pecho firme contra el apoyo. Llevá los codos hacia atrás y abajo, juntá escápulas y volvé despacio.',
        errors: 'Despegar el pecho para ayudarte con impulso, encoger los hombros, recorrido corto.', caution: WRIST }),
      ex({ id: 'lun-jalon', name: 'Jalón al pecho con agarre cómodo', alternative: 'Jalón con agarre neutro', sets: 3, repMin: 8, repMax: 10, main: true,
        how: 'Muslos trabados, pecho alto. Llevá la barra hacia la parte alta del pecho pensando en bajar los codos.',
        errors: 'Tirarte para atrás, llevar la barra detrás de la nuca, soltar de golpe arriba.' }),
      ex({ id: 'lun-press-inclinado', name: 'Press inclinado con mancuernas o máquina', alternative: 'Press inclinado en máquina', sets: 2, repMin: 8, repMax: 12, main: false,
        how: 'Banco a 30° aprox. Bajá controlado hasta un estiramiento cómodo y empujá hacia arriba y levemente adentro.',
        errors: 'Inclinación excesiva (pasa a ser hombro), arquear de más la espalda.', caution: WRIST }),
      ex({ id: 'lun-laterales', name: 'Elevaciones laterales', alternative: 'Elevaciones laterales en polea o máquina', sets: 2, repMin: 12, repMax: 15, main: false,
        how: 'Subí los brazos hacia los costados hasta la altura de los hombros, codos apenas flexionados, bajada lenta.',
        errors: 'Balancear el cuerpo, subir por encima de los hombros encogiéndolos.' }),
      ex({ id: 'lun-triceps', name: 'Tríceps en polea', alternative: 'Tríceps en polea con cuerda', sets: 2, repMin: 10, repMax: 15, main: false,
        how: 'Codos pegados al cuerpo, extendé completo abajo y volvé sin que los codos se adelanten.',
        errors: 'Mover los codos, inclinarte encima de la polea para empujar con el cuerpo.', caution: WRIST }),
    ],
  },
  {
    id: 'martes', weekday: 2, name: 'Piernas A', exercises: [
      ex({ id: 'mar-prensa', name: 'Prensa', alternative: 'A definir con tu entrenador', sets: 3, repMin: 8, repMax: 10, main: true,
        how: 'Pies a la altura de hombros, rodillas en la línea de los pies. Bajá hasta donde mantengas la zona lumbar apoyada y sin dolor.',
        errors: 'Rodillas que se van hacia adentro, despegar la cadera abajo, bloquear las rodillas arriba.', caution: KNEE }),
      ex({ id: 'mar-hip-thrust', name: 'Hip thrust', alternative: 'Hip thrust en máquina', sets: 3, repMin: 8, repMax: 10, main: true,
        how: 'Parte alta de la espalda en el banco, pies firmes. Empujá con la cadera hasta quedar alineado, mentón hacia el pecho, pausa arriba.',
        errors: 'Arquear la zona lumbar en vez de extender la cadera, pies muy lejos o muy cerca.' }),
      ex({ id: 'mar-femoral-sentado', name: 'Curl femoral sentado', alternative: 'Curl femoral acostado', sets: 3, repMin: 10, repMax: 12, main: false,
        how: 'Ajustá el rodillo sobre los tobillos y la rodilla alineada con el eje de la máquina. Flexioná completo y volvé lento.',
        errors: 'Eje de la máquina desalineado con la rodilla, levantar la cadera del asiento.', caution: 'Ajustá bien el eje a la rodilla; si molesta, omitilo y anotá el motivo.' }),
      ex({ id: 'mar-abduccion', name: 'Abducción de cadera en máquina', alternative: 'Abducción con banda', sets: 2, repMin: 12, repMax: 15, main: false,
        how: 'Espalda apoyada, abrí las piernas controlando y volvé sin dejar caer el peso.',
        errors: 'Usar impulso, recorrido mínimo.' }),
      ex({ id: 'mar-gemelos', name: 'Gemelos', alternative: 'Gemelos sentado en máquina', sets: 3, repMin: 12, repMax: 15, main: false,
        how: 'Subí en puntas de pie lo más alto posible, pausa, y bajá hasta estirar.',
        errors: 'Rebotar, recorrido corto, flexionar las rodillas para ayudarte.' }),
      ex({ id: 'mar-dead-bug', name: 'Dead bug', alternative: 'Plancha en rodillas', sets: 2, repMin: 8, repMax: 10, perSide: true, main: false,
        how: 'Boca arriba, zona lumbar suave contra el piso. Estirá brazo y pierna opuestos despacio, sin que la espalda se despegue. Respirá con calma.',
        errors: 'Ir rápido, arquear la espalda, contener la respiración.' }),
    ],
  },
  {
    id: 'miercoles', weekday: 3, name: 'Torso B', exercises: [
      ex({ id: 'mie-jalon-neutro', name: 'Jalón con agarre neutro', alternative: 'Jalón al pecho con agarre cómodo', sets: 3, repMin: 8, repMax: 12, main: true,
        how: 'Agarre neutro, pecho alto, bajá llevando los codos hacia las costillas.',
        errors: 'Balanceo con el torso, recorrido corto arriba.' }),
      ex({ id: 'mie-press-inclinado-maq', name: 'Press inclinado en máquina', alternative: 'Press inclinado con mancuernas', sets: 3, repMin: 8, repMax: 12, main: true,
        how: 'Asiento para que el agarre quede a la altura de la parte alta del pecho. Empujá controlando y volvé lento.',
        errors: 'Despegar los hombros, rebotar abajo.', caution: WRIST }),
      ex({ id: 'mie-remo-sentado', name: 'Remo sentado', alternative: 'Remo con pecho apoyado', sets: 3, repMin: 8, repMax: 12, main: true,
        how: 'Torso quieto y erguido, tirá hacia el abdomen llevando los codos atrás, volvé estirando sin perder postura.',
        errors: 'Balancearte hacia atrás, redondear la espalda al estirar.', caution: WRIST }),
      ex({ id: 'mie-press-hombro', name: 'Press de hombro en máquina', alternative: 'Press de hombro con mancuernas sentado', sets: 2, repMin: 8, repMax: 12, main: false,
        how: 'Espalda apoyada, empujá hacia arriba sin bloquear de golpe y bajá hasta la altura de las orejas aprox.',
        errors: 'Arquear la zona lumbar, recorrido corto.', caution: WRIST }),
      ex({ id: 'mie-posterior', name: 'Hombro posterior en máquina', alternative: 'Face pull en polea', sets: 2, repMin: 12, repMax: 15, main: false,
        how: 'Pecho apoyado, abrí los brazos hacia atrás con codos semiflexionados, pausa breve.',
        errors: 'Encoger los hombros, usar impulso.' }),
      ex({ id: 'mie-biceps', name: 'Curl de bíceps con agarre cómodo', alternative: 'Curl martillo', sets: 2, repMin: 10, repMax: 12, main: false,
        how: 'Codos quietos al costado del cuerpo, subí y bajá controlando.',
        errors: 'Balancear el cuerpo, adelantar los codos.', caution: WRIST }),
    ],
  },
  {
    id: 'jueves', weekday: 4, name: 'Piernas B', exercises: [
      ex({ id: 'jue-sentadilla-banco', name: 'Sentadilla a banco asistida', alternative: 'A definir con tu entrenador', sets: 3, repMin: 8, repMax: 10, main: true,
        how: 'Sostenete de un apoyo, sentate controlando hasta tocar el banco y levantate empujando el piso. Rodillas en la línea de los pies.',
        errors: 'Dejarte caer sobre el banco, rodillas hacia adentro.', caution: 'Condicionada a estabilidad, técnica e indicación del entrenador. ' + KNEE }),
      ex({ id: 'jue-rumano', name: 'Peso muerto rumano con mancuernas', alternative: 'A definir con tu entrenador', sets: 3, repMin: 8, repMax: 10, main: true,
        how: 'Rodillas apenas flexionadas, llevá la cadera hacia atrás con la espalda neutra y las mancuernas cerca de las piernas. Subí empujando la cadera adelante.',
        errors: 'Redondear la espalda, bajar más de lo que tu movilidad permite, convertirlo en sentadilla.', caution: 'Solo con técnica supervisada y sin molestias.' }),
      ex({ id: 'jue-femoral', name: 'Curl femoral', alternative: 'Curl femoral sentado', sets: 3, repMin: 10, repMax: 12, main: false,
        how: 'Alineá la rodilla con el eje, flexioná completo y volvé lento.', errors: 'Levantar la cadera, usar impulso.',
        caution: 'Ajustá bien el eje a la rodilla; si molesta, omitilo y anotá el motivo.' }),
      ex({ id: 'jue-puente', name: 'Puente de glúteos', alternative: 'Hip thrust en máquina', sets: 2, repMin: 10, repMax: 12, main: false,
        how: 'Boca arriba, pies firmes, elevá la cadera apretando glúteos y bajá controlando.', errors: 'Arquear la zona lumbar, empujar con las puntas.' }),
      ex({ id: 'jue-gemelos', name: 'Gemelos', alternative: 'Gemelos sentado en máquina', sets: 3, repMin: 12, repMax: 15, main: false,
        how: 'Subí lo más alto posible, pausa, bajá hasta estirar.', errors: 'Rebotar, recorrido corto.' }),
      ex({ id: 'jue-pallof', name: 'Pallof press', alternative: 'Pallof press en rodillas', sets: 2, repMin: 10, repMax: 10, perSide: true, main: false,
        how: 'De costado a la polea, llevá el agarre al frente del pecho y estirá los brazos resistiendo que te gire. Respirá normal.',
        errors: 'Girar el torso, contener la respiración, estar demasiado cerca de la polea.' }),
    ],
  },
  {
    id: 'viernes', weekday: 5, name: 'Torso C', exercises: [
      ex({ id: 'vie-press-pecho', name: 'Press de pecho en máquina', alternative: 'Press con mancuernas en banco plano', sets: 3, repMin: 8, repMax: 12, main: true,
        how: 'Escápulas apoyadas, empujá controlando y bajá lento.', errors: 'Rebotar, despegar los hombros.', caution: WRIST }),
      ex({ id: 'vie-remo-apoyado', name: 'Remo con pecho apoyado', alternative: 'Remo en máquina', sets: 3, repMin: 8, repMax: 12, main: true,
        how: 'Pecho firme contra el apoyo, codos atrás y abajo, volvé despacio.', errors: 'Despegar el pecho, encoger hombros.', caution: WRIST }),
      ex({ id: 'vie-jalon', name: 'Jalón al pecho', alternative: 'Jalón con agarre neutro', sets: 2, repMin: 10, repMax: 12, main: false,
        how: 'Pecho alto, codos hacia abajo, barra a la parte alta del pecho.', errors: 'Tirarte atrás, soltar de golpe.' }),
      ex({ id: 'vie-laterales', name: 'Elevaciones laterales', alternative: 'Elevaciones laterales en polea o máquina', sets: 2, repMin: 12, repMax: 15, main: false,
        how: 'Brazos hacia los costados hasta la altura de los hombros, bajada lenta.', errors: 'Balancear, encoger los hombros.' }),
      ex({ id: 'vie-biceps', name: 'Curl de bíceps', alternative: 'Curl martillo', sets: 2, repMin: 10, repMax: 12, main: false,
        how: 'Codos quietos, subí y bajá controlando.', errors: 'Balancear el cuerpo.', caution: WRIST }),
      ex({ id: 'vie-triceps', name: 'Tríceps en polea', alternative: 'Tríceps en polea con cuerda', sets: 2, repMin: 10, repMax: 12, main: false,
        how: 'Codos pegados al cuerpo, extendé completo y volvé controlando.', errors: 'Mover los codos.', caution: WRIST }),
    ],
  },
];

export const PRECHECK_TEXT =
  'Antes de trabajar pesado: fijate si la rodilla está estable y sin dolor, y si la respiración está como siempre. ' +
  'Si notás inestabilidad, dolor o falta de aire fuera de lo habitual, bajá la carga, omití el ejercicio o consultá a tu entrenador o a un profesional de la salud.';
