import { useState } from 'react';
import { Chip, Field, Segmented, useConfirm, useToast } from '../components/ui';
import { KIND_LABEL } from '../health/classify';
import { HealthBridge, hasHealthBridge } from '../health/plugin';
import { detectedSources, getHealthMeta, reclassifyAll, syncHealth } from '../health/sync';
import { getSettings, patchSettings } from '../lib/app';
import { formatDateTime } from '../lib/dates';
import { getDB, emitChange, kvSet } from '../lib/db';
import { useLive } from '../lib/hooks';

const TYPE_LABEL: Record<string, string> = { steps: 'pasos', sleep: 'sueño', restingHr: 'FC en reposo', hrDaily: 'FC diaria', workout: 'entrenamientos' };

export function HealthPanel() {
  const s = useLive(getSettings, []);
  const meta = useLive(getHealthMeta, []);
  const sources = useLive(detectedSources, []);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const native = hasHealthBridge();
  if (!s || !meta) return null;

  const connect = async () => {
    setBusy(true);
    try {
      await HealthBridge.requestReadAuthorization();
      const r = await syncHealth(HealthBridge, s);
      toast(`Importación lista: ${r.added} nuevos, ${r.updated} actualizados, ${r.deleted} eliminados`);
    } catch (e) { toast(`No se pudo importar: ${(e as Error).message}`, 'error'); } finally { setBusy(false); }
  };
  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncHealth(HealthBridge, s);
      toast(`Actualizado: ${r.added} nuevos, ${r.updated} actualizados, ${r.deleted} eliminados`);
    } catch (e) { toast(`No se pudo actualizar: ${(e as Error).message}`, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="card stack">
      <h2 className="h2">Salud y Garmin</h2>
      <p className="small">Flujo: <b>reloj Garmin → Garmin Connect → app Salud (Apple Health) → esta app</b>, solo lectura.</p>

      {!native ? (
        <div className="note small">
          <p><b>En el navegador no hay acceso a Salud.</b> Apple no permite que una página web o PWA lea HealthKit. Para importar los datos del reloj hace falta la versión iOS de esta app (incluida en el proyecto, carpeta <code>ios/</code>), instalada desde Xcode en tu iPhone.</p>
          <p>Mientras tanto, el registro manual de pasos, sueño y entrenamientos funciona completo.</p>
        </div>
      ) : (
        <>
          <p className="small muted">Se pide permiso de solo lectura para: pasos, sueño, frecuencia cardíaca, FC en reposo y entrenamientos. Nada se escribe en Salud. Los datos importados quedan guardados solo en este iPhone, dentro de la app.</p>
          <p className="small muted">Por privacidad, iOS no le dice a la app si negaste la lectura: si un tipo aparece "sin datos disponibles", puede ser porque no hay registros o porque el permiso está desactivado (revisalo en Salud › Perfil › Apps › esta app).</p>
          <div className="row gap wrap">
            {!meta.lastSync && <button className="btn primary grow" disabled={busy} onClick={connect}>Conectar con Salud (solo lectura)</button>}
            {meta.lastSync && <button className="btn primary grow" disabled={busy} onClick={sync}>{busy ? 'Actualizando…' : 'Actualizar ahora'}</button>}
          </div>
          <p className="small">Última sincronización: <b>{meta.lastSync ? formatDateTime(meta.lastSync) : 'nunca'}</b>{meta.startDate ? ` · importa desde el ${meta.startDate.split('-').reverse().join('/')}` : ''}</p>
          {meta.lastCounts && <p className="small muted">Última lectura: {Object.entries(meta.lastCounts).map(([k, v]) => `${TYPE_LABEL[k] ?? k}: ${v ? v : 'sin datos disponibles'}`).join(' · ')}</p>}
          {meta.lastError && <p className="note error small" role="alert">Último error: {meta.lastError}</p>}
          <p className="small muted">Garmin Connect envía datos a Salud cuando se sincroniza (normalmente al abrir Garmin Connect). Si faltan datos recientes, abrí Garmin Connect, esperá que sincronice y tocá "Actualizar ahora".</p>
        </>
      )}

      <h3 className="h3">Política de pasos</h3>
      <Field label="Fuente preferida para los pasos del día" hint="Nunca se suman Garmin + iPhone: contarían los mismos pasos dos veces.">
        <Segmented label="Fuente de pasos" value={s.stepSource} onChange={(v) => patchSettings({ stepSource: v })} options={[{ value: 'garmin', label: 'Reloj (Garmin)' }, { value: 'iphone', label: 'iPhone' }]} />
      </Field>
      <Field label="¿Qué completa la meta de pasos?">
        <Segmented label="Base de la meta" value={s.stepGoalBasis} onChange={(v) => patchSettings({ stepGoalBasis: v })} options={[{ value: 'reloj', label: 'Solo datos del reloj' }, { value: 'manual-permitido', label: 'Reloj o manual' }]} />
      </Field>
      <p className="small muted">"Solo datos del reloj" excluye registros manuales (de esta app o marcados como ingresados a mano en Salud). Si no hay datos del reloj ese día, se usa el iPhone o el manual solo como referencia.</p>

      {sources && sources.length > 0 && (
        <>
          <h3 className="h3">Fuentes detectadas</h3>
          <p className="small muted">Elegí cuál es tu reloj si no se detectó automáticamente.</p>
          <ul className="list">
            {sources.map((x) => (
              <li key={x.sourceId} className="row between">
                <span><b>{x.sourceName}</b> <span className="tiny muted">{x.sourceId}</span><br /><span className="small">{[...x.types].map((t) => TYPE_LABEL[t] ?? t).join(', ')} · {x.count} registros</span></span>
                <span className="row gap">
                  <Chip tone={x.kind === 'garmin' ? 'blue' : x.kind === 'manual' ? 'amber' : 'neutral'}>{KIND_LABEL[x.kind as keyof typeof KIND_LABEL]}</Chip>
                  <button className="btn ghost small" aria-pressed={s.watchSourceId === x.sourceId} onClick={async () => { const id = s.watchSourceId === x.sourceId ? null : x.sourceId; await patchSettings({ watchSourceId: id }); await reclassifyAll(id); }}>
                    {s.watchSourceId === x.sourceId ? '✓ Es mi reloj' : 'Es mi reloj'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button className="btn ghost small" onClick={async () => {
            if (!(await confirm({ title: 'Borrar datos importados de Salud?', body: 'Se borran de esta app (no de Salud). La próxima actualización vuelve a importar los últimos 30 días.', ok: 'Borrar', danger: true }))) return;
            const db = await getDB(); await db.clear('health'); await kvSet('healthMeta', { anchors: {}, lastSync: null, startDate: null }, true); emitChange('health');
          }}>Borrar datos importados</button>
        </>
      )}
    </div>
  );
}
