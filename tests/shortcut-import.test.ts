import { beforeEach, describe, expect, it } from 'vitest';
import { importShortcutData, parseShortcutText } from '../src/health/shortcutImport';
import { ensureInitialized } from '../src/lib/app';
import { wipeAll } from '../src/lib/backup';
import { all, patchDay } from '../src/lib/db';
import { loadDaySummary } from '../src/lib/summary';

const today = '2026-11-02';
beforeEach(async () => { await wipeAll(); await ensureInitialized(); });

describe('texto del Atajo', () => {
  it('acepta clave=valor con coma decimal y miles con punto', () => {
    expect(parseShortcutText('fecha=2026-11-02; pasos=12.345; sueno=7,5; fc=62', today)).toEqual({ date: today, steps: 12345, sleepH: 7.5, restingHr: 62 });
    expect(parseShortcutText('pasos: 9876\nfc: 70', today)).toEqual({ date: today, steps: 9876, sleepH: null, restingHr: 70 });
  });
  it('acepta JSON y link con parámetros', () => {
    expect(parseShortcutText('{"fecha":"2026-11-01","pasos":11000}', today)).toMatchObject({ date: '2026-11-01', steps: 11000 });
    expect(parseShortcutText('https://x/#/importar?pasos=8000&sueno=420', today)).toMatchObject({ steps: 8000, sleepH: 7 });
  });
  it('rechaza textos sin datos, fechas futuras y valores imposibles', () => {
    expect(parseShortcutText('hola', today)).toHaveProperty('error');
    expect(parseShortcutText('fecha=2026-11-05; pasos=100', today)).toHaveProperty('error');
    expect(parseShortcutText('pasos=999999', today)).toHaveProperty('error');
  });
});

describe('importación', () => {
  it('cuenta como dato del reloj, completa la meta y no duplica al repetir', async () => {
    await patchDay(today, { stepsManual: 3000 });
    const d = parseShortcutText('pasos=16000; sueno=7,2; fc=61', today);
    if ('error' in d) throw new Error(d.error);
    await importShortcutData(d);
    await importShortcutData({ ...d, steps: 16500 });
    expect((await all('health')).length).toBe(3);
    const s = await loadDaySummary(today);
    expect(s.steps.value).toBe(16500);
    expect(s.steps.origin).toBe('garmin');
    expect(s.stepsMet).toBe(true);
    expect(s.sleep.imported?.asleepH).toBeCloseTo(7.2);
    expect(s.restingHr?.value).toBe(61);
  });
});
