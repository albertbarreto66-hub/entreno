import type { Profile, ScheduleItem, Settings } from '../lib/types';


/** Perfil vacío para la versión publicada en internet: no lleva datos personales en el código. */
const GENERIC_PROFILE: Profile = {
  name: '', age: null, heightCm: null, initialWeightKg: null,
  initialWeightNote: 'Dato inicial pendiente de actualizar: no es una medición de hoy.',
  timezone: 'America/Argentina/Buenos_Aires', work: '', goals: '', preferences: '', avoid: '', supplementsNote: '', history: '',
};

declare const __PERFIL__: Profile | null;

/**
 * El código no lleva datos personales. Si existe private/perfil.json y se compila con
 * PERFIL_PRIVADO=1, ese perfil viene precargado; si no, se carga restaurando el archivo de perfil.
 */
export const DEFAULT_PROFILE: Profile = typeof __PERFIL__ !== 'undefined' && __PERFIL__ ? { ...GENERIC_PROFILE, ...__PERFIL__ } : GENERIC_PROFILE;

export const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { id: 'levantarse', time: '06:45', label: 'Levantarse', remind: false },
  { id: 'desayuno', time: '07:00', label: 'Desayuno', remind: false },
  { id: 'gimnasio', time: '08:00', label: 'Gimnasio (08:00–09:10)', remind: false },
  { id: 'almuerzo', time: '12:30', label: 'Almuerzo', remind: false },
  { id: 'merienda', time: '16:30', label: 'Merienda', remind: false },
  { id: 'caminata', time: '18:30', label: 'Caminata', remind: false },
  { id: 'cena', time: '20:30', label: 'Cena', remind: false },
  { id: 'descanso', time: '22:15', label: 'Preparar descanso', remind: false },
  { id: 'acostarse', time: '22:45', label: 'Acostarse', remind: false },
];

export const DEFAULT_SETTINGS: Settings = {
  dairyEnabled: false,
  preferNoEgg: false,
  adaptationWeeks: 1,
  repeatWeek: false,
  stepGoalBasis: 'manual-permitido',
  stepSource: 'garmin',
  watchSourceId: null,
  systemNotifications: false,
  onboarded: false,
};

/** Referencias iniciales editables (no son prescripción médica). */
export const DEFAULT_GOALS = { steps: 15000, fluidsMl: null as number | null, kcal: 2600, protein: 175 };
export const STEP_GOAL_MAX = 20000;
