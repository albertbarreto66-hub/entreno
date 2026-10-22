export type MealSlot = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'extra';
export const MAIN_SLOTS: MealSlot[] = ['desayuno', 'almuerzo', 'merienda', 'cena'];
export const SLOT_LABEL: Record<MealSlot, string> = {
  desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena', extra: 'Otra comida',
};

export interface Profile {
  name: string;
  age: number | null;
  heightCm: number | null;
  initialWeightKg: number | null;
  initialWeightNote: string;
  timezone: string;
  work: string;
  goals: string;
  preferences: string;
  avoid: string;
  supplementsNote: string;
  history: string; // antecedentes, texto libre (no son diagnósticos)
}

export interface ScheduleItem { id: string; time: string; label: string; remind: boolean }

export interface Settings {
  dairyEnabled: boolean;
  preferNoEgg: boolean;
  adaptationWeeks: number; // semanas con modo adaptación sugerido
  repeatWeek: boolean; // repetir semana: no se sugieren subidas de carga
  stepGoalBasis: 'manual-permitido' | 'reloj';
  stepSource: 'garmin' | 'iphone' | 'otra';
  watchSourceId: string | null; // bundleId elegido como "reloj"
  systemNotifications: boolean;
  onboarded: boolean;
}

export type GoalKind = 'steps' | 'fluidsMl' | 'kcal' | 'protein';
export interface GoalEntry { id: string; kind: GoalKind; value: number | null; from: string; createdAt: number }

export interface DayLog {
  date: string;
  notes?: string;
  recovery?: boolean;
  recoveryReason?: string;
  stepsManual?: number | null;
  sleepHours?: number | null;
  sleepNote?: string;
  pain?: 0 | 1 | 2 | 3; // 0 nada, 1 leve, 2 moderado, 3 fuerte
  recoveryFeel?: 'buena' | 'normal' | 'mala';
  fluidNote?: string; // frecuencia urinaria / molestias (opcional)
  manualTrainingDone?: boolean;
  updatedAt?: number;
}

export interface FoodItem { foodId: string; grams: number }
export interface MealLog {
  id: string;
  date: string;
  slot: MealSlot;
  title: string;
  items: FoodItem[];
  freeText?: string;
  manualKcal?: number | null; // ingresado por el usuario para texto libre
  manualProtein?: number | null;
  fromPlan?: { day: number; slot: MealSlot; noEgg?: boolean; optionId?: string } | null;
  hunger?: number | null; // 1-5
  satiety?: number | null; // 1-5
  bloating?: number | null; // 0-3
  photoId?: string | null;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type FluidKind = 'agua' | 'saborizada' | 'otra';
export interface FluidLog { id: string; date: string; ml: number; kind: FluidKind; label?: string; at: number }

export interface SetLog { kg: number | null; reps: number | null; rir: number | null; done: boolean }
export interface WarmupLog { kg: number | null; reps: number | null }
export interface ExerciseLog {
  exerciseId: string;
  name: string;
  usedAlternative?: boolean;
  plannedSets: number;
  repMin: number;
  repMax: number;
  warmups: WarmupLog[];
  sets: SetLog[];
  pain: number; // 0-10 dolor/molestia articular (separado del esfuerzo)
  painLocation?: string;
  techniqueOk?: boolean | null;
  skipped?: { reason: string; note?: string } | null;
  notes?: string;
}
export type SessionStatus = 'en-curso' | 'completada' | 'incompleta' | 'omitida';
export interface WorkoutSession {
  id: string;
  date: string;
  templateId: string; // lunes..viernes
  templateName: string;
  status: SessionStatus;
  adaptation: boolean;
  reducedSets: boolean;
  preCheck?: { knee: boolean | null; breathing: boolean | null };
  exercises: ExerciseLog[];
  omitReason?: string;
  noDetail?: boolean; // marcado como hecho sin registrar series
  startedAt: number;
  finishedAt?: number;
  updatedAt: number;
}

export interface BodyLog { id: string; date: string; weightKg?: number | null; waistCm?: number | null; note?: string; at: number }

export type PhotoPose = 'frente' | 'perfil' | 'espalda';
export interface PhotoRec {
  id: string;
  kind: 'progreso' | 'comida';
  date: string;
  pose?: PhotoPose;
  blob: Blob;
  type: string;
  width: number;
  height: number;
  weightKg?: number | null;
  waistCm?: number | null;
  note?: string;
  at: number;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  alternative: string;
  sets: number;
  repMin: number;
  repMax: number;
  perSide?: boolean;
  restSec: [number, number];
  main: boolean;
  how: string;
  errors: string;
  caution?: string;
  incrementKg: number;
}
export interface DayTemplate { id: string; weekday: number; name: string; exercises: ExerciseTemplate[] }

export interface ExerciseState { exerciseId: string; targetKg?: number | null; acceptedAt?: number; dismissedFor?: string | null }

// Datos importados de Apple Health (solo en la versión iOS)
export type HealthType = 'steps' | 'sleep' | 'restingHr' | 'hrDaily' | 'workout';
export type SourceKind = 'garmin' | 'iphone' | 'watch-otro' | 'manual' | 'otra';
export interface HealthRecord {
  uuid: string;
  type: HealthType;
  start: number;
  end: number;
  date: string; // día local al que se asigna
  value: number; // pasos | código sueño | lpm | duración seg
  value2?: number | null; // hrDaily: mín | workout: kcal
  value3?: number | null; // hrDaily: máx | workout: fc media
  label?: string; // tipo de entrenamiento
  sourceName: string;
  sourceId: string; // bundle identifier
  productType?: string | null;
  deviceName?: string | null;
  userEntered: boolean;
  kind: SourceKind;
  importedAt: number;
  updatedAt: number;
}
export interface HealthMeta { anchors: Record<string, string | null>; lastSync: number | null; startDate: string | null; lastError?: string | null; lastCounts?: Record<string, number> }
