import { Capacitor } from '@capacitor/core';
import type { ScheduleItem } from './types';

/**
 * Avisos del horario.
 * - App iOS: notificaciones locales programadas por el sistema (funcionan con la app cerrada).
 * - Navegador/PWA: solo mientras la app está abierta (no hay servidor de push).
 */
let timers: number[] = [];

export function notificationSupport(): 'nativo' | 'navegador' | 'no' {
  if (Capacitor.isNativePlatform()) return 'nativo';
  return typeof Notification !== 'undefined' ? 'navegador' : 'no';
}

export async function requestPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  }
  if (typeof Notification === 'undefined') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function applyReminders(items: ScheduleItem[], enabled: boolean) {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
  const active = enabled ? items.filter((i) => i.remind) : [];
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!active.length) return;
    await LocalNotifications.schedule({
      notifications: active.map((it, idx) => {
        const [hour, minute] = it.time.split(':').map(Number);
        return { id: 1000 + idx, title: it.label, body: 'Recordatorio de tu horario (editable en Ajustes).', schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true } };
      }),
    });
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const now = new Date();
  for (const it of active) {
    const [h, m] = it.time.split(':').map(Number);
    const t = new Date(now); t.setHours(h, m, 0, 0);
    const ms = t.getTime() - now.getTime();
    if (ms > 0 && ms < 24 * 3600 * 1000) timers.push(window.setTimeout(() => new Notification(it.label, { body: 'Recordatorio de tu horario' }), ms));
  }
}
