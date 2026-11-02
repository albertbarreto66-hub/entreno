import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { ensureInitialized, getSchedule } from '../src/lib/app';
import { isProfileOnly, mergeProfile, parseBackup, wipeAll } from '../src/lib/backup';
import { all, get, kvGet, put } from '../src/lib/db';
import { goalFor } from '../src/lib/goals';
import { applyProgram, menuAverages, nextMonday, PROGRAM_SCHEDULE } from '../src/lib/programApply';

beforeEach(async () => { await wipeAll(); await ensureInitialized(); });

describe('aplicar programa', () => {
  it('fija la semana 1, metas desde hoy (sin tocar el pasado) y el horario nuevo', async () => {
    await applyProgram({ today: '2026-11-02', start: '2026-11-02', stepsStart: 10000 });
    const goals = await all('goals');
    expect(goalFor(goals, 'kcal', '2026-11-01')).toBe(2600); // valor anterior
    expect(goalFor(goals, 'kcal', '2026-11-02')).toBe(menuAverages().kcal);
    expect(goalFor(goals, 'steps', '2026-11-02')).toBe(10000);
    expect(await kvGet('programStart')).toBe('2026-11-02');
    expect((await getSchedule())[0].time).toBe(PROGRAM_SCHEDULE[0].time);
  });
  it('el programa arranca el lunes', () => {
    expect(nextMonday('2026-11-02')).toBe('2026-11-02');
    expect(nextMonday('2026-11-04')).toBe('2026-11-09');
    expect(nextMonday('2026-11-08')).toBe('2026-11-09');
  });
  it('menú promedio cerca de 2.450 kcal y 185 g de proteína', () => {
    const m = menuAverages();
    expect(m.kcal).toBeGreaterThanOrEqual(2400);
    expect(m.kcal).toBeLessThanOrEqual(2550);
    expect(m.protein).toBeGreaterThanOrEqual(175);
  });
});

describe('archivo de perfil', () => {
  it('carga perfil y medidas sin borrar los registros existentes', async () => {
    await put('meals', { id: 'm1', date: '2026-11-01', slot: 'cena', title: 'x', items: [], createdAt: 1, updatedAt: 1 });
    const zip = new JSZip();
    zip.file('data.json', JSON.stringify({ format: 'entreno-albert-backup', version: 1, stores: {
      kv: [{ key: 'profile', value: { name: 'Albert', age: 25, heightCm: 186, sex: 'masculino' } }, { key: 'target6m', value: { weightKg: 92, waistCm: 96 } }],
      body: [{ id: 'b1', date: '2026-11-01', weightKg: 110, waistCm: 120, chestCm: 110, bicepsCm: 41, at: 1 }],
      photos: [{ id: 'g1', kind: 'objetivo', date: '2026-11-02', type: 'image/png', width: 1, height: 1, at: 1, file: 'photos/g1.png' }],
    } }));
    zip.file('photos/g1.png', new Uint8Array([137, 80, 78, 71]));
    const parsed = await parseBackup(await zip.generateAsync({ type: 'blob' }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(isProfileOnly(parsed)).toBe(true);
    await mergeProfile(parsed);
    expect(await get('meals', 'm1')).toBeTruthy();
    expect((await get('body', 'b1'))?.chestCm).toBe(110);
    expect((await kvGet<{ name: string }>('profile'))?.name).toBe('Albert');
    expect((await get('photos', 'g1'))?.kind).toBe('objetivo');
    expect(await kvGet('target6m')).toEqual({ weightKg: 92, waistCm: 96 });
  });
});
