const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
export const n0 = (v: number) => nf0.format(v);
export const n1 = (v: number) => nf1.format(v);

/** Decimal: acepta coma o punto ("42,5" o "42.5"). Devuelve null si no es número. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Entero: ignora separadores de miles ("15.000" → 15000). */
export function parseIntLoose(s: string): number | null {
  const t = s.replace(/[^\d]/g, '');
  if (t === '') return null;
  return Number(t);
}

export const uid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
