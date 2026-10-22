import { beforeEach, describe, expect, it } from 'vitest';
import { all, get } from '../src/lib/db';
import { wipeAll } from '../src/lib/backup';
import { startOfDayMs } from '../src/lib/dates';
import { getHealthMeta, syncHealth } from '../src/health/sync';
import type { ChangeType, ChangesResult, HealthBridgePlugin, HrDailyRow, RawSample } from '../src/health/plugin';
import { loadDaySummary } from '../src/lib/summary';
import { ensureInitialized } from '../src/lib/app';

/** Doble de prueba que imita HKAnchoredObjectQuery: devuelve cambios desde un ancla. */
class FakeHealth implements HealthBridgePlugin {
  log: { v: number; op: 'add' | 'del'; type: ChangeType; s?: RawSample; id?: string }[] = [];
  hr: HrDailyRow[] = [];
  v = 0;
  add(type: ChangeType, s: RawSample) { this.log.push({ v: ++this.v, op: 'add', type, s }); }
  remove(type: ChangeType, id: string) { this.log.push({ v: ++this.v, op: 'del', type, id }); }
  async isAvailable() { return { available: true }; }
  async requestReadAuthorization() { return { requested: true }; }
  async fetchChanges({ type, anchor }: { type: ChangeType; anchor: string | null }): Promise<ChangesResult> {
    const from = anchor ? Number(anchor) : 0;
    const ev = this.log.filter((e) => e.type === type && e.v > from);
    return { samples: ev.filter((e) => e.op === 'add').map((e) => e.s!), deleted: ev.filter((e) => e.op === 'del').map((e) => e.id!), anchor: String(this.v) };
  }
  async fetchHeartRateDaily() { return { rows: this.hr }; }
}

const D = '2026-10-22';
const t0 = startOfDayMs(D);
const now = t0 + 20 * 3600e3;
const garmin = { sourceName: 'Connect', sourceId: 'com.garmin.connect.mobile', productType: null, userEntered: false };
const iphone = { sourceName: 'iPhone de Albert', sourceId: 'com.apple.health.ABC', productType: 'iPhone15,2', userEntered: false };

beforeEach(async () => { await wipeAll(); await ensureInitialized(); });

describe('importación desde Salud', () => {
  it('es repetible: no duplica, aplica borrados y respeta la política de pasos', async () => {
    const f = new FakeHealth();
    f.add('steps', { uuid: 'g1', start: t0 + 8 * 3600e3, end: t0 + 9 * 3600e3, value: 9000, ...garmin });
    f.add('steps', { uuid: 'g2', start: t0 + 10 * 3600e3, end: t0 + 11 * 3600e3, value: 7000, ...garmin });
    f.add('steps', { uuid: 'i1', start: t0 + 8 * 3600e3, end: t0 + 11 * 3600e3, value: 14000, ...iphone });
    f.add('steps', { uuid: 'm1', start: t0 + 12 * 3600e3, end: t0 + 12 * 3600e3, value: 5000, ...garmin, userEntered: true });
    f.add('workout', { uuid: 'w1', start: t0 + 8 * 3600e3, end: t0 + 9 * 3600e3, value: 3600, value2: 300, value3: 120, label: 'Fuerza tradicional', ...garmin });
    f.hr = [{ date: D, sourceId: garmin.sourceId, sourceName: 'Connect', avg: 72, min: 55, max: 140 }];

    const s = { watchSourceId: null };
    const r1 = await syncHealth(f, s, { now });
    expect(r1.added).toBe(6);
    const r2 = await syncHealth(f, s, { now: now + 1000 });
    expect(r2.added).toBe(0);
    expect((await all('health')).length).toBe(6);

    const sum = await loadDaySummary(D);
    expect(sum.steps.value).toBe(16000); // solo Garmin, sin el manual ni el iPhone
    expect(sum.steps.phone).toBe(14000);
    expect(sum.stepsMet).toBe(true);
    // Una actividad de gimnasio NO marca el entrenamiento como completo
    expect(sum.watchWorkouts).toHaveLength(1);
    expect(sum.trainingDone).toBe(false);

    // Garmin corrige un registro: Salud lo informa como borrado + nuevo
    f.remove('steps', 'g2');
    f.add('steps', { uuid: 'g3', start: t0 + 10 * 3600e3, end: t0 + 11 * 3600e3, value: 5000, ...garmin });
    f.hr = [];
    const r3 = await syncHealth(f, s, { now: now + 2000 });
    expect(r3.deleted).toBe(2); // g2 + la FC diaria que ya no existe
    expect(await get('health', 'g2')).toBeUndefined();
    expect((await loadDaySummary(D)).steps.value).toBe(14000);

    const rec = await get('health', 'g1');
    expect(rec).toMatchObject({ kind: 'garmin', sourceId: garmin.sourceId, date: D, importedAt: now });
    const meta = await getHealthMeta();
    expect(meta.lastSync).toBe(now + 2000);
    expect(meta.anchors.steps).toBe(String(f.v));
  });
  it('sin muestras: queda "sin datos", no cero', async () => {
    const f = new FakeHealth();
    await syncHealth(f, { watchSourceId: null }, { now });
    const sum = await loadDaySummary(D);
    expect(sum.steps.value).toBeNull();
    expect(sum.sleep.hours).toBeNull();
  });
});
