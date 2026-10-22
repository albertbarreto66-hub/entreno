import { useEffect, useRef, useState } from 'react';
import { onChange } from './db';

/** Ejecuta una consulta y la repite cuando cambian los datos. */
export function useLive<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const [v, setV] = useState<T>();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    const run = () => fnRef.current().then((r) => { if (alive) setV(r); }).catch((e) => console.error(e));
    run();
    const off = onChange(run);
    return () => { alive = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

/** Fecha/hora que se actualiza cada minuto (para detectar el cambio de día). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [intervalMs]);
  return now;
}
