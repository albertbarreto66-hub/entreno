import JSZip from 'jszip';
import { emitChange, getDB, STORES, type StoreName } from './db';
import type { PhotoRec } from './types';

export const BACKUP_FORMAT = 'entreno-albert-backup';
export const BACKUP_VERSION = 1;

const KEY_OF: Record<StoreName, string> = {
  kv: 'key', days: 'date', meals: 'id', fluids: 'id', sessions: 'id', body: 'id', photos: 'id', goals: 'id', exState: 'exerciseId', health: 'uuid',
};
const DATED: StoreName[] = ['days', 'meals', 'fluids', 'sessions', 'body', 'photos'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const extFor = (type: string) => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');

/** Genera el ZIP con data.json (registros) y la carpeta photos/ (imágenes originales guardadas). */
export async function exportBackup(): Promise<Blob> {
  const db = await getDB();
  const zip = new JSZip();
  const stores: Record<string, unknown[]> = {};
  for (const s of STORES) {
    const rows = (await db.getAll(s)) as Record<string, unknown>[];
    if (s === 'photos') {
      stores[s] = (rows as unknown as PhotoRec[]).map((p) => {
        const file = `photos/${p.id}.${extFor(p.type)}`;
        zip.file(file, p.blob);
        const { blob: _b, ...rest } = p;
        void _b;
        return { ...rest, file };
      });
    } else stores[s] = rows;
  }
  zip.file('data.json', JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), stores }, null, 1));
  zip.file('LEEME.txt', 'Respaldo de la app Entreno.\ndata.json: registros. photos/: fotos.\nSe restaura desde Ajustes > Respaldo > Restaurar.\n');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export interface BackupPreview {
  exportedAt: string;
  counts: Record<string, number>;
  photoCount: number;
  firstDate: string | null;
  lastDate: string | null;
}
export interface ParsedBackup { ok: true; preview: BackupPreview; stores: Record<StoreName, Record<string, unknown>[]> }
export interface BackupError { ok: false; errors: string[] }

/** Lee y valida un ZIP de respaldo SIN tocar los datos actuales. */
export async function parseBackup(file: Blob): Promise<ParsedBackup | BackupError> {
  const errors: string[] = [];
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(file); } catch { return { ok: false, errors: ['El archivo no es un ZIP válido.'] }; }
  // data.json puede estar en la raíz o dentro de una carpeta (si el ZIP se descomprimió y se volvió a comprimir).
  const candidates = zip.file(/(^|\/)data\.json$/).filter((f) => !f.name.startsWith('__MACOSX/'));
  const dataFile = zip.file('data.json') ?? candidates.sort((a, b) => a.name.length - b.name.length)[0] ?? null;
  if (!dataFile) {
    if (zip.file(/(^|\/)package\.json$/).length) return { ok: false, errors: ['Este es el ZIP con el código de la app, no un respaldo. Elegí "perfil-albert.zip" o un respaldo exportado desde Ajustes.'] };
    return { ok: false, errors: ['Este archivo no es un respaldo de Entreno (no tiene data.json). Elegí "perfil-albert.zip" o un respaldo exportado desde Ajustes.'] };
  }
  const prefix = dataFile.name.slice(0, dataFile.name.length - 'data.json'.length);
  let data: { format?: string; version?: number; exportedAt?: string; stores?: Record<string, unknown> };
  try { data = JSON.parse(await dataFile.async('string')); } catch { return { ok: false, errors: ['data.json está dañado o no es JSON.'] }; }
  if (data.format !== BACKUP_FORMAT) errors.push('No es un respaldo de esta app.');
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) errors.push(`Versión de respaldo no compatible (${String(data.version)}).`);
  if (!data.stores || typeof data.stores !== 'object') errors.push('Faltan los registros.');
  if (errors.length) return { ok: false, errors };

  const stores = {} as Record<StoreName, Record<string, unknown>[]>;
  const counts: Record<string, number> = {};
  let firstDate: string | null = null, lastDate: string | null = null;
  for (const s of STORES) {
    const rows = (data.stores as Record<string, unknown>)[s] ?? [];
    if (!Array.isArray(rows)) { errors.push(`"${s}" no es una lista.`); continue; }
    const seen = new Set<string>();
    rows.forEach((r, idx) => {
      if (!r || typeof r !== 'object') { errors.push(`${s}[${idx}] no es un registro.`); return; }
      const key = (r as Record<string, unknown>)[KEY_OF[s]];
      if (typeof key !== 'string' || !key) errors.push(`${s}[${idx}] no tiene identificador.`);
      else if (seen.has(key)) errors.push(`${s}: identificador repetido ${key}.`);
      else seen.add(key);
      if (DATED.includes(s)) {
        const d = (r as Record<string, unknown>).date;
        if (typeof d !== 'string' || !DATE_RE.test(d)) errors.push(`${s}[${idx}] tiene una fecha inválida.`);
        else { if (!firstDate || d < firstDate) firstDate = d; if (!lastDate || d > lastDate) lastDate = d; }
      }
    });
    stores[s] = rows as Record<string, unknown>[];
    counts[s] = rows.length;
  }
  // Fotos: cada registro debe tener su archivo
  for (const p of stores.photos ?? []) {
    const f = typeof p.file === 'string' ? zip.file(prefix + p.file) : null;
    if (!f) { errors.push(`Falta el archivo de la foto ${String(p.id)}.`); continue; }
    const type = typeof p.type === 'string' && p.type.startsWith('image/') ? p.type : 'image/jpeg';
    const buf = await f.async('arraybuffer');
    if (buf.byteLength === 0) errors.push(`La foto ${String(p.id)} está vacía.`);
    p.blob = new Blob([buf], { type });
    delete p.file;
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
  return {
    ok: true, stores,
    preview: { exportedAt: data.exportedAt ?? '', counts, photoCount: stores.photos.length, firstDate, lastDate },
  };
}

/** Reemplaza TODOS los datos por los del respaldo, en una sola transacción (todo o nada). */
export async function applyBackup(parsed: ParsedBackup) {
  const db = await getDB();
  const tx = db.transaction([...STORES], 'readwrite');
  for (const s of STORES) {
    const os = tx.objectStore(s);
    await os.clear();
    for (const r of parsed.stores[s]) await os.put(r);
  }
  await tx.done;
  emitChange('*');
}

export async function currentCounts() {
  const db = await getDB();
  const out: Record<string, number> = {};
  for (const s of STORES) out[s] = await db.count(s);
  return out;
}

export async function wipeAll() {
  const db = await getDB();
  const tx = db.transaction([...STORES], 'readwrite');
  for (const s of STORES) await tx.objectStore(s).clear();
  await tx.done;
  emitChange('*');
}

export function backupFileName(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `respaldo-entreno-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.zip`;
}
