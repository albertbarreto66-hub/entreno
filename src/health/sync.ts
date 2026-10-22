import { addDays, dateKey, DEFAULT_TZ, endOfDayMs, startOfDayMs } from '../lib/dates';
import { emitChange, getDB, kvGet, kvSet } from '../lib/db';
import type { HealthMeta, HealthRecord, HealthType, Settings } from '../lib/types';
import { classifySource } from './classify';
import type { ChangeType, HealthBridgePlugin, RawSample } from './plugin';

export const META_KEY = 'healthMeta';
export const CHANGE_TYPES: ChangeType[] = ['steps', 'sleep', 'restingHr', 'workout'];
export const INITIAL_DAYS = 30;
export const HR_WINDOW_DAYS = 14;

export async function getHealthMeta(): Promise<HealthMeta> {
  return (await kvGet<HealthMeta>(META_KEY)) ?? { anchors: {}, lastSync: null, startDate: null };
}

function assignDate(type: HealthType, r: RawSample, tz: string) {
  return dateKey(type === 'sleep' ? r.end : r.start, tz);
}

export function toRecord(type: HealthType, r: RawSample, now: number, tz: string, watchSourceId: string | null, prev?: HealthRecord): HealthRecord {
  return {
    uuid: r.uuid, type, start: r.start, end: r.end, date: assignDate(type, r, tz),
    value: r.value, value2: r.value2 ?? null, value3: r.value3 ?? null, label: r.label ?? undefined,
    sourceName: r.sourceName, sourceId: r.sourceId, productType: r.productType ?? null, deviceName: r.deviceName ?? null,
    userEntered: !!r.userEntered,
    kind: classifySource({ sourceId: r.sourceId, sourceName: r.sourceName, productType: r.productType, userEntered: !!r.userEntered }, watchSourceId),
    importedAt: prev?.importedAt ?? now, updatedAt: now,
  };
}

export interface SyncResult { added: number; updated: number; deleted: number; byType: Record<string, number> }

/**
 * Importación repetible: usa anclas de HKAnchoredObjectQuery por tipo, inserta o actualiza por
 * UUID y borra los registros que Salud informa como eliminados. La FC diaria se recalcula en una
 * ventana reciente con IDs deterministas (fecha + fuente), así no se duplica.
 */
export async function syncHealth(plugin: HealthBridgePlugin, settings: Pick<Settings, 'watchSourceId'>, opts: { now?: number; tz?: string } = {}): Promise<SyncResult> {
  const now = opts.now ?? Date.now();
  const tz = opts.tz ?? DEFAULT_TZ;
  const meta = await getHealthMeta();
  const today = dateKey(now, tz);
  const startDate = meta.startDate ?? addDays(today, -INITIAL_DAYS);
  const res: SyncResult = { added: 0, updated: 0, deleted: 0, byType: {} };
  const db = await getDB();
  const anchors = { ...meta.anchors };

  try {
    const { available } = await plugin.isAvailable();
    if (!available) throw new Error('Salud (HealthKit) no está disponible en este dispositivo.');

    for (const type of CHANGE_TYPES) {
      const ch = await plugin.fetchChanges({ type, anchor: anchors[type] ?? null, startMs: startOfDayMs(startDate, tz) });
      const tx = db.transaction('health', 'readwrite');
      for (const s of ch.samples) {
        const prev = (await tx.store.get(s.uuid)) as HealthRecord | undefined;
        await tx.store.put(toRecord(type, s, now, tz, settings.watchSourceId, prev));
        if (prev) res.updated++; else res.added++;
      }
      for (const id of ch.deleted) {
        if (await tx.store.get(id)) { await tx.store.delete(id); res.deleted++; }
      }
      await tx.done;
      anchors[type] = ch.anchor;
      res.byType[type] = ch.samples.length;
    }

    // Frecuencia cardíaca diaria (mín/prom/máx por fuente)
    const hrFrom = startDate > addDays(today, -HR_WINDOW_DAYS) ? startDate : addDays(today, -HR_WINDOW_DAYS);
    const { rows } = await plugin.fetchHeartRateDaily({ startMs: startOfDayMs(hrFrom, tz), endMs: endOfDayMs(today, tz), timeZone: tz });
    const tx = db.transaction('health', 'readwrite');
    const existing = (await tx.store.index('type').getAll('hrDaily')) as HealthRecord[];
    const keep = new Set<string>();
    for (const r of rows) {
      const uuid = `hr:${r.date}:${r.sourceId}`;
      keep.add(uuid);
      const prev = existing.find((e) => e.uuid === uuid);
      const ds = startOfDayMs(r.date, tz);
      const rec = toRecord('hrDaily', { uuid, start: ds, end: endOfDayMs(r.date, tz), value: r.avg, value2: r.min, value3: r.max, sourceId: r.sourceId, sourceName: r.sourceName, productType: r.productType, userEntered: false }, now, tz, settings.watchSourceId, prev);
      rec.date = r.date;
      await tx.store.put(rec);
      if (prev) res.updated++; else res.added++;
    }
    for (const e of existing) {
      if (e.date >= hrFrom && !keep.has(e.uuid)) { await tx.store.delete(e.uuid); res.deleted++; }
    }
    await tx.done;
    res.byType.hrDaily = rows.length;

    await kvSet<HealthMeta>(META_KEY, { anchors, lastSync: now, startDate, lastError: null, lastCounts: res.byType }, true);
  } catch (e) {
    await kvSet<HealthMeta>(META_KEY, { ...meta, anchors, startDate, lastError: e instanceof Error ? e.message : String(e) }, true);
    emitChange('health');
    throw e;
  }
  emitChange('health');
  return res;
}

/** Re-clasifica registros cuando el usuario elige otra fuente como "reloj". */
export async function reclassifyAll(watchSourceId: string | null) {
  const db = await getDB();
  const tx = db.transaction('health', 'readwrite');
  for (const r of (await tx.store.getAll()) as HealthRecord[]) {
    const kind = classifySource(r, watchSourceId);
    if (kind !== r.kind) await tx.store.put({ ...r, kind });
  }
  await tx.done;
  emitChange('health');
}

/** Lista de fuentes detectadas (para que el usuario confirme cuál es su reloj). */
export async function detectedSources() {
  const db = await getDB();
  const recs = (await db.getAll('health')) as HealthRecord[];
  const m = new Map<string, { sourceId: string; sourceName: string; kind: string; count: number; types: Set<string> }>();
  for (const r of recs) {
    const k = r.sourceId;
    if (!m.has(k)) m.set(k, { sourceId: r.sourceId, sourceName: r.sourceName, kind: r.kind, count: 0, types: new Set() });
    const v = m.get(k)!; v.count++; v.types.add(r.type);
  }
  return [...m.values()];
}
