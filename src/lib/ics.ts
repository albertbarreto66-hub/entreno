import type { ScheduleItem } from './types';

/**
 * Recordatorios como archivo de Calendario (.ics): el iPhone los avisa aunque la app esté cerrada,
 * sin servidor. Cada ítem del horario se repite todos los días (el gimnasio, de lunes a viernes).
 * Zona fija America/Argentina/Buenos_Aires (UTC−3, sin horario de verano).
 */
export interface IcsOptions { startDate: string; appUrl: string; water: boolean }

export const WATER_TIMES = ['10:30', '13:30', '16:00', '19:30'];

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
const fold = (line: string) => {
  // Líneas de hasta 75 octetos (RFC 5545); se cortan por caracteres para no romper acentos.
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
};

const MESSAGES: Record<string, string> = {
  levantarse: 'Arriba. 10 minutos de luz natural y desayuno.',
  desayuno: 'Desayuno del plan. Registralo en Forja.',
  gimnasio: 'Hora del gimnasio: abrí Forja → Entrenar.',
  almuerzo: 'Almuerzo del plan + 10 minutos de caminata.',
  cafeina: 'Último mate o café del día.',
  merienda: 'Merienda del plan (whey en agua).',
  caminata: 'Caminata de 30–45 minutos. Mirá cuántos pasos llevás.',
  cena: 'Cena sin carbohidratos + caminata corta.',
  descanso: 'Preparar descanso: luz baja y sin pantallas.',
  acostarse: 'A la cama. Mañana te levantás a las 08:00.',
};

export function buildIcs(items: ScheduleItem[], o: IcsOptions) {
  const d0 = o.startDate.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const events: { id: string; time: string; title: string; body: string; weekdays?: boolean; minutes: number }[] = items.map((it) => ({
    id: it.id, time: it.time, title: it.label, body: MESSAGES[it.id] ?? it.label,
    weekdays: it.id === 'gimnasio', minutes: it.id === 'gimnasio' ? 60 : 10,
  }));
  if (o.water) for (const t of WATER_TIMES) events.push({ id: `agua-${t.replace(':', '')}`, time: t, title: 'Agua', body: '¿Tomaste agua? Registrala en Forja (+250 / +500 ml).', minutes: 5 });
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forja//Recordatorios//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Forja', 'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
    'BEGIN:VTIMEZONE', 'TZID:America/Argentina/Buenos_Aires', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  for (const e of events) {
    const [h, m] = e.time.split(':');
    lines.push(
      'BEGIN:VEVENT', `UID:entreno-${e.id}@entreno`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/Argentina/Buenos_Aires:${d0}T${h}${m}00`, `DURATION:PT${e.minutes}M`,
      e.weekdays ? 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' : 'RRULE:FREQ=DAILY',
      `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(o.appUrl ? `${e.body}\n${o.appUrl}` : e.body)}`, ...(o.appUrl ? [`URL:${o.appUrl}`] : []), 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.body)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
