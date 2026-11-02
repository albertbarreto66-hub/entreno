// Genera un respaldo ZIP que solo contiene el perfil personal y la configuración inicial,
// para restaurarlo en la versión publicada (que no lleva datos personales en el código).
// Uso: npx vite-node scripts/perfil.ts [salida.zip]
import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Profile } from '../src/lib/types';

// Lee el perfil de private/perfil.json (fuera del repositorio).
const PERSONAL_PROFILE: Profile = JSON.parse(readFileSync(new URL('../private/perfil.json', import.meta.url), 'utf8'));
import { ensureInitialized } from '../src/lib/app';
import { exportBackup } from '../src/lib/backup';
import { del, kvSet, put } from '../src/lib/db';

await ensureInitialized();
await kvSet('profile', PERSONAL_PROFILE, true);
await del('kv', 'programStart'); // la semana 1 empieza el día que la uses
// Medidas iniciales opcionales (private/medidas.json, fuera del repositorio)
try {
  const medidas = JSON.parse(readFileSync(new URL('../private/medidas.json', import.meta.url), 'utf8'));
  for (const m of medidas) await put('body', m, true);
} catch { /* sin medidas */ }
// Objetivo a 6 meses y fotos del físico objetivo (private/objetivo.json y private/objetivo/*.png)
try { await kvSet('target6m', JSON.parse(readFileSync(new URL('../private/objetivo.json', import.meta.url), 'utf8')), true); } catch { /* sin objetivo */ }
try {
  const dir = new URL('../private/objetivo/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => /\.png$/i.test(x)).sort()) {
    const buf = readFileSync(new URL(f, dir));
    const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20); // cabecera PNG (IHDR)
    await put('photos', { id: `objetivo-${f.replace(/\W/g, '')}`, kind: 'objetivo', date: '2026-11-02', blob: new Blob([buf], { type: 'image/png' }), type: 'image/png', width, height, note: 'Físico objetivo a 6 meses', at: Date.now() }, true);
  }
} catch { /* sin fotos */ }
const blob = await exportBackup();
const out = process.argv[2] ?? 'perfil-albert.zip';
writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
console.log('Generado', out);
