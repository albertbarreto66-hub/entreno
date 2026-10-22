import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { ensureInitialized } from '../src/lib/app';
import { applyBackup, exportBackup, parseBackup, wipeAll } from '../src/lib/backup';
import { all, byDate, get, getDay, patchDay, put, resetDBConnection } from '../src/lib/db';
import { DEFAULT_TEMPLATES } from '../src/data/templates';
import { newSession } from '../src/lib/training';
import { loadDaySummary } from '../src/lib/summary';
import { logPlanMeal } from '../src/lib/meals';

beforeEach(async () => { await wipeAll(); });

describe('persistencia en IndexedDB', () => {
  it('una serie registrada se recupera tras cerrar y reabrir la base (recarga)', async () => {
    const s = newSession(DEFAULT_TEMPLATES[0], '2026-10-19', { adaptation: true, reducedSets: false });
    s.exercises[0].sets[0] = { kg: 42.5, reps: 8, rir: 2, done: true };
    await put('sessions', s);
    await resetDBConnection();
    const back = await get('sessions', s.id);
    expect(back?.exercises[0].sets[0]).toEqual({ kg: 42.5, reps: 8, rir: 2, done: true });
    expect(back?.status).toBe('en-curso');
  });
  it('los registros de días distintos no se mezclan', async () => {
    await ensureInitialized();
    await patchDay('2026-10-21', { stepsManual: 9000 });
    await patchDay('2026-10-22', { stepsManual: 12000 });
    await put('fluids', { id: 'f1', date: '2026-10-21', ml: 500, kind: 'agua', at: 1 });
    await put('fluids', { id: 'f2', date: '2026-10-22', ml: 250, kind: 'agua', at: 2 });
    await logPlanMeal('2026-10-22', 'desayuno', false);
    const a = await loadDaySummary('2026-10-21');
    const b = await loadDaySummary('2026-10-22');
    expect(a.steps.value).toBe(9000);
    expect(b.steps.value).toBe(12000);
    expect(a.fluidTotal).toBe(500);
    expect(b.fluidTotal).toBe(250);
    expect(a.meals).toHaveLength(0);
    expect(b.meals).toHaveLength(1);
    expect(b.meals[0].fromPlan?.day).toBe(4); // jueves
  });
  it('patchDay conserva los demás campos', async () => {
    await patchDay('2026-10-22', { notes: 'hola' });
    await patchDay('2026-10-22', { sleepHours: 7 });
    expect(await getDay('2026-10-22')).toMatchObject({ notes: 'hola', sleepHours: 7 });
  });
});

describe('respaldo ZIP', () => {
  it('exporta y restaura registros y fotos (blobs) con validación previa', async () => {
    await ensureInitialized();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5]);
    await put('photos', { id: 'p1', kind: 'progreso', date: '2026-10-19', pose: 'frente', blob: new Blob([bytes], { type: 'image/jpeg' }), type: 'image/jpeg', width: 3, height: 4, at: 1 });
    await put('body', { id: 'b1', date: '2026-10-19', weightKg: 109.4, waistCm: 108, at: 1 });
    const zipBlob = await exportBackup();

    const z = await JSZip.loadAsync(zipBlob);
    expect(z.file('data.json')).toBeTruthy();
    expect(z.file('photos/p1.jpg')).toBeTruthy();

    await wipeAll();
    expect(await all('body')).toHaveLength(0);
    const parsed = await parseBackup(zipBlob);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.preview.counts.photos).toBe(1);
    expect(parsed.preview.firstDate).toBe('2026-10-19');
    expect(await all('body')).toHaveLength(0); // parsear no modifica nada
    await applyBackup(parsed);
    const ph = await get('photos', 'p1');
    expect(new Uint8Array(await ph!.blob.arrayBuffer())).toEqual(bytes);
    expect((await byDate('body', '2026-10-19'))[0].weightKg).toBe(109.4);
    expect((await all('goals')).length).toBeGreaterThan(0);
  });
  it('rechaza archivos inválidos sin tocar los datos', async () => {
    await put('body', { id: 'keep', date: '2026-10-19', weightKg: 100, at: 1 });
    expect((await parseBackup(new Blob(['hola']))).ok).toBe(false);
    const z = new JSZip();
    z.file('data.json', JSON.stringify({ format: 'otra-app', version: 1, stores: {} }));
    expect((await parseBackup(await z.generateAsync({ type: 'blob' }))).ok).toBe(false);
    const z2 = new JSZip();
    z2.file('data.json', JSON.stringify({ format: 'entreno-albert-backup', version: 1, stores: { photos: [{ id: 'x', date: '2026-10-19', file: 'photos/x.jpg' }], days: [{ date: 'mal' }] } }));
    const r = await parseBackup(await z2.generateAsync({ type: 'blob' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/foto x|fecha inválida/);
    expect(await get('body', 'keep')).toBeTruthy();
  });
  it('acepta un respaldo comprimido dentro de una carpeta y reconoce el ZIP del código', async () => {
    await put('photos', { id: 'p2', kind: 'progreso', date: '2026-10-19', pose: 'perfil', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), type: 'image/jpeg', width: 1, height: 1, at: 1 });
    const orig = await JSZip.loadAsync(await exportBackup());
    const nested = new JSZip();
    for (const [name, f] of Object.entries(orig.files)) if (!f.dir) nested.file('perfil-albert/' + name, await f.async('uint8array'));
    const r = await parseBackup(await nested.generateAsync({ type: 'blob' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.preview.photoCount).toBe(1);
    const code = new JSZip();
    code.file('entreno/package.json', '{}');
    const r2 = await parseBackup(await code.generateAsync({ type: 'blob' }));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors[0]).toMatch(/código de la app/);
  });
});

