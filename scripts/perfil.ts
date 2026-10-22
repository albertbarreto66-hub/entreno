// Genera un respaldo ZIP que solo contiene el perfil personal y la configuración inicial,
// para restaurarlo en la versión publicada (que no lleva datos personales en el código).
// Uso: npx vite-node scripts/perfil.ts [salida.zip]
import 'fake-indexeddb/auto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Profile } from '../src/lib/types';

// Lee el perfil de private/perfil.json (fuera del repositorio).
const PERSONAL_PROFILE: Profile = JSON.parse(readFileSync(new URL('../private/perfil.json', import.meta.url), 'utf8'));
import { ensureInitialized } from '../src/lib/app';
import { exportBackup } from '../src/lib/backup';
import { del, kvSet } from '../src/lib/db';

await ensureInitialized();
await kvSet('profile', PERSONAL_PROFILE, true);
await del('kv', 'programStart'); // la semana 1 empieza el día que la uses
const blob = await exportBackup();
const out = process.argv[2] ?? 'perfil-albert.zip';
writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
console.log('Generado', out);
