// Fechas locales como claves 'YYYY-MM-DD' en la zona horaria del usuario.
// Nunca usamos toISOString() para decidir "hoy": eso daría la fecha en UTC.

export const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

function parts(d: Date, tz: string) {
  const o: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** Clave de fecha local para un instante. */
export function dateKey(d: Date | number = new Date(), tz = DEFAULT_TZ): string {
  const p = parts(typeof d === 'number' ? new Date(d) : d, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora local 'HH:MM' para un instante. */
export function timeHM(d: Date | number, tz = DEFAULT_TZ): string {
  const p = parts(typeof d === 'number' ? new Date(d) : d, tz);
  return `${p.hour}:${p.minute}`;
}

export function todayKey(tz = DEFAULT_TZ) { return dateKey(new Date(), tz); }

function keyToUTCNoon(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(key: string, n: number): string {
  const d = keyToUTCNoon(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (independiente de la zona horaria). */
export function weekday(key: string): number { return keyToUTCNoon(key).getUTCDay(); }

/** Lunes de la semana de la fecha. */
export function weekStart(key: string): string {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function diffDays(a: string, b: string): number {
  return Math.round((keyToUTCNoon(b).getTime() - keyToUTCNoon(a).getTime()) / 86400000);
}

export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Offset (min) de la zona respecto de UTC para un instante. */
function tzOffsetMin(utcMs: number, tz: string) {
  const p = parts(new Date(utcMs), tz);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - Math.floor(utcMs / 1000) * 1000) / 60000;
}

/** Instante (ms) del comienzo del día local `key` en la zona `tz`. */
export function startOfDayMs(key: string, tz = DEFAULT_TZ): number {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ms = guess - tzOffsetMin(guess, tz) * 60000;
  ms = guess - tzOffsetMin(ms, tz) * 60000; // segunda pasada por cambios de horario
  return ms;
}

export function endOfDayMs(key: string, tz = DEFAULT_TZ) { return startOfDayMs(addDays(key, 1), tz); }

const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function weekdayName(key: string) { return WD[weekday(key)]; }

export function formatLong(key: string) {
  const [, m, d] = key.split('-').map(Number);
  return `${WD[weekday(key)]} ${d} de ${MO[m - 1]}`;
}

export function formatShort(key: string) {
  const [, m, d] = key.split('-').map(Number);
  return `${d}/${m}`;
}

export function formatDateTime(ms: number, tz = DEFAULT_TZ) {
  return `${formatShort(dateKey(ms, tz))} ${timeHM(ms, tz)}`;
}
