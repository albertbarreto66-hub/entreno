import { addDays, dateKey, DEFAULT_TZ, endOfDayMs, startOfDayMs } from '../lib/dates';
import { emitChange, getDB, kvSet } from '../lib/db';
import type { HealthRecord } from '../lib/types';
import { getHealthMeta, META_KEY } from './sync';

/**
 * Importación desde la app Atajos (Shortcuts) del iPhone, sin Mac ni app nativa:
 * el Atajo lee Salud (donde Garmin Connect deja sus datos), arma un texto como
 *   fecha=2026-11-02; pasos=12345; sueno=7,4; fc=62
 * y lo copia. La app lo pega y lo guarda como dato del reloj (uno por día: repetir no duplica).
 */
export interface ShortcutData { date: string; steps: number | null; sleepH: number | null; restingHr: number | null }

const num = (v: string | undefined) => {
  if (v == null) return null;
  const t = v.trim().replace(/\s/g, '');
  if (!t) return null;
  // "12.345" (miles) o "7,5" (decimal)
  const n = /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, '')) : Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function parseShortcutText(text: string, today: string): ShortcutData | { error: string } {
  const raw = text.trim();
  if (!raw) return { error: 'No hay texto para importar.' };
  const kv: Record<string, string> = {};
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') for (const [k, v] of Object.entries(j)) kv[k.toLowerCase()] = String(v);
  } catch {
    const body = raw.includes('?') && raw.startsWith('http') ? raw.slice(raw.indexOf('?') + 1) : raw;
    for (const part of body.split(/[;&\n]+/)) {
      const m = part.match(/^\s*([a-záéíóúñ_]+)\s*[=:]\s*(.+?)\s*$/i);
      if (m) kv[m[1].toLowerCase()] = decodeURIComponent(m[2]);
    }
  }
  const pick = (...ks: string[]) => ks.map((k) => kv[k]).find((v) => v != null);
  const date = (pick('fecha', 'date') ?? today).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `Fecha inválida: ${date}. Usá el formato aaaa-MM-dd.` };
  if (date > today || date < addDays(today, -30)) return { error: 'La fecha tiene que ser de los últimos 30 días.' };
  const steps = num(pick('pasos', 'steps'));
  let sleepH = num(pick('sueno', 'sueño', 'sueno_h', 'sleep'));
  if (sleepH != null && sleepH > 24) sleepH = sleepH / 60; // si vino en minutos
  if (sleepH != null && sleepH > 16) sleepH = sleepH / 60; // si vino en segundos→minutos
  const restingHr = num(pick('fc', 'fc_reposo', 'rhr'));
  if (steps == null && sleepH == null && restingHr == null) return { error: 'No encontré pasos, sueño ni frecuencia cardíaca en el texto.' };
  if (steps != null && (steps < 0 || steps > 150000)) return { error: 'Pasos fuera de rango.' };
  if (sleepH != null && (sleepH < 0 || sleepH > 16)) return { error: 'Horas de sueño fuera de rango.' };
  if (restingHr != null && (restingHr < 25 || restingHr > 220)) return { error: 'Frecuencia cardíaca fuera de rango.' };
  return { date, steps: steps != null ? Math.round(steps) : null, sleepH: sleepH != null ? Math.round(sleepH * 100) / 100 : null, restingHr: restingHr != null ? Math.round(restingHr) : null };
}

const SOURCE = { sourceId: 'atajo.garmin', sourceName: 'Garmin (vía Atajo)', productType: null, deviceName: null, userEntered: false, kind: 'garmin' as const };

/** Guarda (o reemplaza) los datos del día. IDs fijos por fecha: importar dos veces no duplica. */
export async function importShortcutData(d: ShortcutData, now = Date.now(), tz = DEFAULT_TZ) {
  const db = await getDB();
  const tx = db.transaction('health', 'readwrite');
  const ds = startOfDayMs(d.date, tz), de = endOfDayMs(d.date, tz);
  const upsert = async (rec: Omit<HealthRecord, 'importedAt' | 'updatedAt'>) => {
    const prev = (await tx.store.get(rec.uuid)) as HealthRecord | undefined;
    await tx.store.put({ ...rec, importedAt: prev?.importedAt ?? now, updatedAt: now });
  };
  if (d.steps != null) await upsert({ uuid: `atajo:steps:${d.date}`, type: 'steps', start: ds, end: de - 1, date: d.date, value: d.steps, ...SOURCE });
  if (d.sleepH != null) {
    const end = ds + 8 * 3600e3; // se asigna a la noche que termina ese día
    await upsert({ uuid: `atajo:sleep:${d.date}`, type: 'sleep', start: end - d.sleepH * 3600e3, end, date: d.date, value: 1, ...SOURCE });
  }
  if (d.restingHr != null) await upsert({ uuid: `atajo:rhr:${d.date}`, type: 'restingHr', start: ds, end: ds, date: d.date, value: d.restingHr, ...SOURCE });
  await tx.done;
  const meta = await getHealthMeta();
  await kvSet(META_KEY, { ...meta, lastSync: now, lastError: null }, true);
  emitChange('health');
}

export const SHORTCUT_NAME = 'Entreno Garmin';
export const shortcutRunUrl = () => `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
export const todayKeyFor = (ms = Date.now()) => dateKey(ms);
