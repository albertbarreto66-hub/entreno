import { registerSW } from 'virtual:pwa-register';

/**
 * Actualizaciones de la app instalada: busca una versión nueva al abrir, al volver a la app
 * y cada 30 minutos. Cuando hay una, el service worker la activa y la página se recarga sola.
 */
let registration: ServiceWorkerRegistration | undefined;
let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;

export function startUpdates() {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registration = r;
      const check = () => { if (navigator.onLine) r?.update().catch(() => {}); };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });
}

/** Botón "Buscar actualización": consulta ya y, si hay versión nueva, la aplica. */
export async function checkForUpdate(): Promise<'actualizando' | 'al-dia' | 'sin-conexion' | 'no-disponible'> {
  if (!registration) return 'no-disponible';
  if (!navigator.onLine) return 'sin-conexion';
  await registration.update();
  const waiting = registration.waiting ?? registration.installing;
  if (waiting) { await applyUpdate?.(true); return 'actualizando'; }
  return 'al-dia';
}
