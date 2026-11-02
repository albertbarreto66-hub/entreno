import type { ScheduleItem } from '../lib/types';

/** Horario propuesto por el programa (editable en Ajustes → Horario). */
export const PROGRAM_SCHEDULE: ScheduleItem[] = [
  { id: 'levantarse', time: '08:00', label: 'Levantarse (siempre a la misma hora) + luz natural 10 min', remind: false },
  { id: 'desayuno', time: '08:20', label: 'Desayuno', remind: false },
  { id: 'gimnasio', time: '09:30', label: 'Gimnasio (60 min)', remind: false },
  { id: 'almuerzo', time: '13:00', label: 'Almuerzo + caminata de 10 min', remind: false },
  { id: 'cafeina', time: '16:00', label: 'Último mate o café del día', remind: false },
  { id: 'merienda', time: '17:00', label: 'Merienda', remind: false },
  { id: 'caminata', time: '18:30', label: 'Caminata (30–45 min, ritmo en el que puedas hablar)', remind: false },
  { id: 'cena', time: '21:00', label: 'Cena (sin carbohidratos) + caminata corta', remind: false },
  { id: 'descanso', time: '23:30', label: 'Preparar descanso: luz baja, sin pantallas', remind: false },
  { id: 'acostarse', time: '00:00', label: 'Acostarse (meta; ir adelantando 30 min por semana)', remind: false },
];
