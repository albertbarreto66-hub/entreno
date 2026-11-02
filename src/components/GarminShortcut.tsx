import { useState } from 'react';
import { importShortcutData, parseShortcutText, SHORTCUT_NAME, shortcutRunUrl } from '../health/shortcutImport';
import { todayKey } from '../lib/dates';
import { n0, n1 } from '../lib/format';
import { useToast } from './ui';

/** Importar pasos, sueño y FC en reposo del Garmin vía la app Atajos (sin Mac). */
export function GarminShortcutImport({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [showManual, setShowManual] = useState(false);

  const doImport = async (raw: string) => {
    const r = parseShortcutText(raw, todayKey());
    if ('error' in r) { toast(r.error, 'error'); return false; }
    await importShortcutData(r);
    toast(`Garmin: ${[r.steps != null && `${n0(r.steps)} pasos`, r.sleepH != null && `${n1(r.sleepH)} h de sueño`, r.restingHr != null && `FC reposo ${r.restingHr}`].filter(Boolean).join(' · ')}`);
    setText('');
    return true;
  };
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      await doImport(t);
    } catch {
      setShowManual(true);
      toast('No pude leer lo copiado: pegalo en el cuadro de abajo.', 'error');
    }
  };

  return (
    <div className="stack">
      <div className="row gap wrap">
        <a className="btn secondary grow" href={shortcutRunUrl()}>1 · Ejecutar Atajo</a>
        <button className="btn primary grow" onClick={paste}>2 · Pegar datos de Garmin</button>
      </div>
      {(showManual || !compact) && (
        <div className="row gap">
          <input aria-label="Texto del Atajo" placeholder="O pegá acá: pasos=12345; sueno=7,5; fc=62" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn ghost small" disabled={!text} onClick={() => doImport(text)}>Importar</button>
        </div>
      )}
      {!compact && <ShortcutHowTo />}
    </div>
  );
}

export function ShortcutHowTo() {
  return (
    <details className="howto">
      <summary>Cómo crear el Atajo "{SHORTCUT_NAME}" (una sola vez, 5 minutos)</summary>
      <ol className="list small">
        <li>En Garmin Connect: <b>Configuración → Aplicaciones conectadas → Apple Salud</b>, activalo y permití pasos, sueño y frecuencia cardíaca.</li>
        <li>Abrí la app <b>Atajos</b> → <b>+</b> → nombre: <b>{SHORTCUT_NAME}</b> (exactamente así).</li>
        <li><b>Pasos</b>: agregá <i>Buscar muestras de Salud</i> → Tipo: <b>Pasos</b>; filtro <b>Fecha de inicio · es hoy</b>; filtro <b>Fuente · es</b> → elegí la app de Garmin (suele aparecer como "Connect"). Después <i>Calcular estadísticas</i> → <b>Suma</b>.</li>
        <li><b>FC en reposo</b> (opcional): <i>Buscar muestras de Salud</i> → Tipo: <b>Frecuencia cardíaca en reposo</b>; Fecha de inicio · en los últimos 1 días; ordenar por más reciente; límite 1.</li>
        <li><b>Sueño</b> (opcional): <i>Buscar muestras de Salud</i> → Tipo: <b>Análisis del sueño</b>; Fecha de finalización · es hoy; Fuente · Garmin. Luego <i>Obtener detalles de muestras de Salud</i> → <b>Duración</b> y <i>Calcular estadísticas</i> → Suma. Si el total te da el doble de lo real, sacá esta parte.</li>
        <li><i>Texto</i>: <code>fecha=</code>[Fecha actual con formato personalizado <code>yyyy-MM-dd</code>]<code>; pasos=</code>[Suma de pasos]<code>; fc=</code>[FC]<code>; sueno=</code>[Suma de sueño]. Lo que no uses, no lo pongas.</li>
        <li><i>Copiar al portapapeles</i> (el Texto) y, si querés, <i>Mostrar notificación</i>: "Listo, volvé a Entreno y tocá Pegar".</li>
        <li>Usalo: abrí Garmin Connect para que sincronice → en Entreno tocá <b>1 · Ejecutar Atajo</b> → volvé a Entreno → <b>2 · Pegar datos de Garmin</b>.</li>
      </ol>
      <p className="tiny muted">El Atajo lee Salud en tu iPhone; la app recibe solo el texto que pegás. Importar el mismo día otra vez reemplaza los datos (no duplica). Los pasos del Atajo cuentan como datos del reloj. Los nombres de los menús de Atajos pueden variar un poco según la versión de iOS.</p>
    </details>
  );
}
