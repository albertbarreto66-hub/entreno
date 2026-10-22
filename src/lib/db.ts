import { openDB, type IDBPDatabase } from 'idb';
import type {
  BodyLog, DayLog, ExerciseState, FluidLog, GoalEntry, HealthRecord, MealLog, PhotoRec, WorkoutSession,
} from './types';

export const DB_NAME = 'entreno-albert';
export const DB_VERSION = 1;

/** Stores con datos del usuario (todos se incluyen en el respaldo). */
export const STORES = ['kv', 'days', 'meals', 'fluids', 'sessions', 'body', 'photos', 'goals', 'exState', 'health'] as const;
export type StoreName = (typeof STORES)[number];

export interface StoreTypes {
  kv: { key: string; value: unknown };
  days: DayLog;
  meals: MealLog;
  fluids: FluidLog;
  sessions: WorkoutSession;
  body: BodyLog;
  photos: PhotoRec;
  goals: GoalEntry;
  exState: ExerciseState;
  health: HealthRecord;
}

let dbp: Promise<IDBPDatabase> | null = null;

export function getDB(name = DB_NAME) {
  if (!dbp) {
    dbp = openDB(name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('kv', { keyPath: 'key' });
        db.createObjectStore('days', { keyPath: 'date' });
        for (const s of ['meals', 'fluids', 'sessions', 'body', 'photos'] as const) {
          const os = db.createObjectStore(s, { keyPath: 'id' });
          os.createIndex('date', 'date');
        }
        const g = db.createObjectStore('goals', { keyPath: 'id' });
        g.createIndex('kind', 'kind');
        db.createObjectStore('exState', { keyPath: 'exerciseId' });
        const h = db.createObjectStore('health', { keyPath: 'uuid' });
        h.createIndex('date', 'date');
        h.createIndex('type', 'type');
      },
    });
  }
  return dbp;
}

/** Solo para pruebas: cerrar y olvidar la conexión. */
export async function resetDBConnection() {
  if (dbp) (await dbp).close();
  dbp = null;
}

// ---- Notificación de cambios (las pantallas se refrescan solas) ----
type Listener = (info: { store: string; quiet?: boolean }) => void;
const listeners = new Set<Listener>();
export function onChange(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
export function emitChange(store: string, quiet = false) { for (const l of listeners) l({ store, quiet }); }

// ---- Operaciones genéricas ----
export async function put<S extends StoreName>(store: S, value: StoreTypes[S], quiet = false) {
  const db = await getDB();
  await db.put(store, value);
  emitChange(store, quiet);
  return value;
}

export async function del(store: StoreName, key: string) {
  const db = await getDB();
  await db.delete(store, key);
  emitChange(store);
}

export async function get<S extends StoreName>(store: S, key: string): Promise<StoreTypes[S] | undefined> {
  const db = await getDB();
  return db.get(store, key);
}

export async function all<S extends StoreName>(store: S): Promise<StoreTypes[S][]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function byDate<S extends 'meals' | 'fluids' | 'sessions' | 'body' | 'photos' | 'health'>(
  store: S, date: string,
): Promise<StoreTypes[S][]> {
  const db = await getDB();
  return db.getAllFromIndex(store, 'date', date);
}

export async function byDateRange<S extends 'meals' | 'fluids' | 'sessions' | 'body' | 'photos' | 'health'>(
  store: S, from: string, to: string,
): Promise<StoreTypes[S][]> {
  const db = await getDB();
  return db.getAllFromIndex(store, 'date', IDBKeyRange.bound(from, to));
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const r = await get('kv', key);
  return r?.value as T | undefined;
}
export async function kvSet<T>(key: string, value: T, quiet = false) {
  await put('kv', { key, value }, quiet);
}

export async function getDay(date: string): Promise<DayLog> {
  return (await get('days', date)) ?? { date };
}
export async function patchDay(date: string, patch: Partial<DayLog>) {
  const cur = await getDay(date);
  return put('days', { ...cur, ...patch, date, updatedAt: Date.now() });
}
