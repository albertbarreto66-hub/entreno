import type { HealthRecord, SourceKind } from '../lib/types';

export interface RawSourceInfo { sourceId: string; sourceName: string; productType?: string | null; userEntered: boolean }

/**
 * Clasifica el origen de un registro de Salud.
 * - Registros con HKMetadataKeyWasUserEntered = true → manual (no cuentan para metas "del reloj").
 * - Garmin Connect escribe en Salud con su propio bundle/nombre de app → garmin.
 * - Muestras guardadas por el propio iPhone → iphone (productType "iPhone…").
 * Si el usuario eligió explícitamente una fuente como "reloj" en Ajustes, esa tiene prioridad.
 */
export function classifySource(s: RawSourceInfo, watchSourceId?: string | null): SourceKind {
  if (s.userEntered) return 'manual';
  if (watchSourceId && s.sourceId === watchSourceId) return 'garmin';
  const id = s.sourceId.toLowerCase();
  const name = s.sourceName.toLowerCase();
  if (id.includes('garmin') || name.includes('garmin')) return 'garmin';
  const pt = (s.productType ?? '').toLowerCase();
  if (pt.startsWith('iphone')) return 'iphone';
  if (pt.startsWith('watch')) return 'watch-otro';
  if (id.startsWith('com.apple.health') && !pt) return 'iphone';
  return 'otra';
}

export const KIND_LABEL: Record<SourceKind, string> = {
  garmin: 'Garmin', iphone: 'iPhone', 'watch-otro': 'Otro reloj', manual: 'Manual', otra: 'Otra app',
};

// Códigos de HKCategoryValueSleepAnalysis
export const SLEEP = { inBed: 0, asleepUnspecified: 1, awake: 2, asleepCore: 3, asleepDeep: 4, asleepREM: 5 } as const;
const ASLEEP = new Set<number>([SLEEP.asleepUnspecified, SLEEP.asleepCore, SLEEP.asleepDeep, SLEEP.asleepREM]);

function mergedDuration(intervals: [number, number][]) {
  const iv = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let total = 0, cs = -1, ce = -1;
  for (const [s, e] of iv) {
    if (s > ce) { if (ce > cs) total += ce - cs; cs = s; ce = e; }
    else ce = Math.max(ce, e);
  }
  if (ce > cs) total += ce - cs;
  return total;
}

export interface SleepSummary { asleepH: number | null; inBedH: number | null; sourceName: string; kind: SourceKind }

/**
 * Sueño asignado al día en que terminó (día de despertarse). Usa una sola fuente
 * (preferencia: reloj → iPhone → otra), une intervalos superpuestos para no contar doble
 * y excluye registros manuales de Salud.
 */
export function summarizeSleep(recs: HealthRecord[], preferWatch = true): SleepSummary | null {
  const sl = recs.filter((r) => r.type === 'sleep' && !r.userEntered);
  if (!sl.length) return null;
  const bySource = new Map<string, HealthRecord[]>();
  for (const r of sl) { if (!bySource.has(r.sourceId)) bySource.set(r.sourceId, []); bySource.get(r.sourceId)!.push(r); }
  const rank = (k: SourceKind) => (preferWatch ? { garmin: 0, 'watch-otro': 1, iphone: 2, otra: 3, manual: 9 } : { iphone: 0, garmin: 1, 'watch-otro': 2, otra: 3, manual: 9 })[k];
  const [, chosen] = [...bySource.entries()].sort((a, b) => rank(a[1][0].kind) - rank(b[1][0].kind))[0];
  const asleep = mergedDuration(chosen.filter((r) => ASLEEP.has(r.value)).map((r) => [r.start, r.end]));
  const inBed = mergedDuration(chosen.filter((r) => r.value === SLEEP.inBed).map((r) => [r.start, r.end]));
  return {
    asleepH: asleep > 0 ? asleep / 3600000 : null,
    inBedH: inBed > 0 ? inBed / 3600000 : null,
    sourceName: chosen[0].sourceName, kind: chosen[0].kind,
  };
}
