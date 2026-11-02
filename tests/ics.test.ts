import { describe, expect, it } from 'vitest';
import { buildIcs } from '../src/lib/ics';
import { PROGRAM_SCHEDULE } from '../src/lib/programApply';

describe('recordatorios en Calendario (.ics)', () => {
  const ics = buildIcs(PROGRAM_SCHEDULE, { startDate: '2026-11-03', appUrl: 'https://x.github.io/entreno/', water: true });
  const unfolded = ics.replace(/\r\n /g, '');
  it('es un calendario válido con un evento por ítem del horario más el agua', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(PROGRAM_SCHEDULE.length + 4);
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(PROGRAM_SCHEDULE.length + 4);
  });
  it('hora local de Buenos Aires, diario y el gimnasio de lunes a viernes', () => {
    expect(unfolded).toContain('DTSTART;TZID=America/Argentina/Buenos_Aires:20261103T080000');
    expect(unfolded).toContain('DTSTART;TZID=America/Argentina/Buenos_Aires:20261103T000000'); // acostarse 00:00
    expect(unfolded).toMatch(/UID:entreno-gimnasio@entreno[\s\S]*?RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
    expect(unfolded).toMatch(/UID:entreno-cena@entreno[\s\S]*?RRULE:FREQ=DAILY/);
  });
  it('líneas de hasta 75 octetos y UIDs estables (importar de nuevo actualiza, no duplica)', () => {
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(buildIcs(PROGRAM_SCHEDULE, { startDate: '2026-11-03', appUrl: 'u', water: false })).not.toContain('UID:entreno-agua');
  });
});
