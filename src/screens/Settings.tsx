import { useEffect, useState } from 'react';
import { useNav } from '../App';
import { NumInput } from '../components/NumInput';
import { Chip, Field, Segmented, useConfirm, useToast } from '../components/ui';
import { DEFAULT_TEMPLATES } from '../data/templates';
import { DEFAULT_SCHEDULE, STEP_GOAL_MAX } from '../data/profile';
import { getProfile, getSchedule, getSettings, patchSettings } from '../lib/app';
import { applyBackup, backupFileName, currentCounts, exportBackup, parseBackup, wipeAll, type ParsedBackup } from '../lib/backup';
import { formatDateTime, formatShort } from '../lib/dates';
import { all, kvGet, kvSet } from '../lib/db';
import { saveFile } from '../lib/files';
import { n0, uid } from '../lib/format';
import { setGoal } from '../lib/goals';
import { useLive } from '../lib/hooks';
import { applyReminders, notificationSupport, requestPermission } from '../lib/notify';
import { getTemplates } from '../lib/training';
import type { DayTemplate, GoalKind, Profile, ScheduleItem } from '../lib/types';
import { HealthPanel } from './HealthPanel';

const LABELS: Record<string, string> = { kv: 'Ajustes y perfil', days: 'Días (notas, pasos, sueño)', meals: 'Comidas', fluids: 'Líquidos', sessions: 'Sesiones de entrenamiento', body: 'Peso y cintura', photos: 'Fotos', goals: 'Historial de metas', exState: 'Progresiones aceptadas', health: 'Datos importados de Salud' };

export function SettingsScreen() {
  return (
    <div className="stack-lg">
      <h1 className="h1">Perfil y ajustes</h1>
      <nav className="toc" aria-label="Secciones">
        {[['perfil', 'Perfil'], ['metas', 'Metas'], ['horario', 'Horario'], ['plantillas', 'Plantillas'], ['salud', 'Salud / Garmin'], ['respaldo', 'Respaldo'], ['privacidad', 'Privacidad']].map(([id, l]) => (
          <a key={id} href={`#/ajustes/${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>{l}</a>
        ))}
      </nav>
      <ProfileSection />
      <GoalsSection />
      <PrefsSection />
      <ScheduleSection />
      <TemplatesSection />
      <section id="salud"><HealthPanel /></section>
      <BackupSection />
      <PrivacySection />
    </div>
  );
}

function ProfileSection() {
  const p = useLive(getProfile, []);
  const [d, setD] = useState<Profile | null>(null);
  useEffect(() => { if (p) setD(p); }, [p]);
  if (!d) return null;
  const save = (patch: Partial<Profile>) => { const nd = { ...d, ...patch }; setD(nd); kvSet('profile', nd); };
  const txt = (k: keyof Profile, label: string, rows = 2) => (
    <Field label={label}><textarea rows={rows} defaultValue={String(d[k] ?? '')} onBlur={(e) => e.target.value !== String(d[k] ?? '') && save({ [k]: e.target.value } as Partial<Profile>)} /></Field>
  );
  return (
    <section className="card stack" id="perfil">
      <h2 className="h2">Perfil</h2>
      <p className="small muted">Datos privados y editables. Sirven de contexto; no son diagnósticos.</p>
      <div className="grid2">
        <Field label="Nombre"><input defaultValue={d.name} onBlur={(e) => e.target.value !== d.name && save({ name: e.target.value })} /></Field>
        <Field label="Edad informada"><NumInput label="Edad" integer value={d.age} max={120} onCommit={(v) => save({ age: v })} /></Field>
        <Field label="Altura (cm)"><NumInput label="Altura" value={d.heightCm} max={250} onCommit={(v) => save({ heightCm: v })} /></Field>
        <Field label="Último peso informado (kg)" hint="Dato inicial pendiente de actualizar."><NumInput label="Peso inicial" value={d.initialWeightKg} max={300} onCommit={(v) => save({ initialWeightKg: v })} /></Field>
      </div>
      <Field label="Zona horaria"><input value={d.timezone} readOnly aria-readonly="true" /></Field>
      {txt('work', 'Trabajo y actividad')}
      {txt('goals', 'Objetivos')}
      {txt('preferences', 'Preferencias')}
      {txt('avoid', 'Evitar en comidas')}
      {txt('supplementsNote', 'Suplementos (nota)')}
      {txt('history', 'Antecedentes para adaptar el ejercicio (no son diagnósticos)', 3)}
    </section>
  );
}

function GoalsSection() {
  const { today } = useNav();
  const goals = useLive(() => all('goals'), []);
  const [vals, setVals] = useState<Record<GoalKind, string>>({ steps: '', fluidsMl: '', kcal: '', protein: '' });
  const toast = useToast();
  if (!goals) return null;
  const cur = (k: GoalKind) => goals.filter((g) => g.kind === k && g.from <= today).sort((a, b) => a.from.localeCompare(b.from) || a.createdAt - b.createdAt).at(-1)?.value ?? null;
  const meta: { k: GoalKind; label: string; unit: string; min: number; max: number; optional?: boolean }[] = [
    { k: 'steps', label: 'Pasos diarios', unit: 'pasos', min: 1000, max: STEP_GOAL_MAX },
    { k: 'fluidsMl', label: 'Líquidos (meta personal opcional)', unit: 'ml', min: 500, max: 6000, optional: true },
    { k: 'kcal', label: 'Referencia de calorías', unit: 'kcal', min: 1200, max: 5000 },
    { k: 'protein', label: 'Referencia de proteína', unit: 'g', min: 40, max: 350 },
  ];
  const apply = async (k: GoalKind, v: number | null, min: number, max: number) => {
    if (v != null && (v < min || v > max)) { toast(`Valor entre ${n0(min)} y ${n0(max)}.`, 'error'); return; }
    await setGoal(k, v, today);
    setVals((x) => ({ ...x, [k]: '' }));
  };
  return (
    <section className="card stack" id="metas">
      <h2 className="h2">Metas</h2>
      <p className="small muted">Los cambios rigen desde hoy. Los días anteriores conservan la meta que tenían (historial abajo).</p>
      {meta.map((m) => (
        <div key={m.k} className="goalrow">
          <Field label={`${m.label} — actual: ${cur(m.k) != null ? `${n0(cur(m.k)!)} ${m.unit}` : 'sin meta'}`}>
            <div className="row gap">
              <input inputMode="numeric" placeholder="Nuevo valor" value={vals[m.k]} onChange={(e) => setVals((x) => ({ ...x, [m.k]: e.target.value }))} />
              <button className="btn secondary" disabled={!vals[m.k]} onClick={() => apply(m.k, Number(vals[m.k].replace(/\D/g, '')), m.min, m.max)}>Aplicar</button>
              {m.optional && cur(m.k) != null && <button className="btn ghost" onClick={() => apply(m.k, null, m.min, m.max)}>Sin meta</button>}
            </div>
          </Field>
        </div>
      ))}
      <p className="small muted">Pasos: la plantilla inicial no supera {n0(STEP_GOAL_MAX)}. Líquidos: no hay meta fija; no se premia beber de más. Calorías y proteína son referencias iniciales, no prescripción médica.</p>
      <details>
        <summary>Historial de metas</summary>
        <ul className="list small">
          {[...goals].sort((a, b) => b.from.localeCompare(a.from) || b.createdAt - a.createdAt).map((g) => (
            <li key={g.id}>{meta.find((m) => m.k === g.kind)?.label}: {g.value != null ? n0(g.value) : 'sin meta'} desde {g.from === '2000-01-01' ? 'el inicio' : formatShort(g.from)}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function PrefsSection() {
  const s = useLive(getSettings, []);
  if (!s) return null;
  return (
    <section className="card stack">
      <h2 className="h2">Preferencias</h2>
      <label className="switch"><input type="checkbox" checked={s.dairyEnabled} onChange={(e) => patchSettings({ dairyEnabled: e.target.checked })} /><span>Mostrar opciones con queso o yogur (desactivado al inicio)</span></label>
      <label className="switch"><input type="checkbox" checked={s.preferNoEgg} onChange={(e) => patchSettings({ preferNoEgg: e.target.checked })} /><span>Usar siempre la alternativa sin huevo</span></label>
      <Field label="Semanas con modo adaptación sugerido">
        <Segmented label="Semanas de adaptación" value={s.adaptationWeeks} onChange={(v) => patchSettings({ adaptationWeeks: v })} options={[0, 1, 2, 3].map((v) => ({ value: v, label: String(v) }))} />
      </Field>
      <label className="switch"><input type="checkbox" checked={s.repeatWeek} onChange={(e) => patchSettings({ repeatWeek: e.target.checked })} /><span>Repetir semana (no sugerir subidas de carga)</span></label>
    </section>
  );
}

function ScheduleSection() {
  const sch = useLive(getSchedule, []);
  const s = useLive(getSettings, []);
  const toast = useToast();
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  useEffect(() => { if (sch) setItems(sch); }, [sch]);
  if (!items || !s) return null;
  const support = notificationSupport();
  const save = async (next: ScheduleItem[]) => { setItems(next); await kvSet('schedule', next); await applyReminders(next, s.systemNotifications).catch(() => {}); };
  const toggleSystem = async (on: boolean) => {
    if (on && !(await requestPermission())) { toast('No se otorgó permiso de notificaciones.', 'error'); return; }
    await patchSettings({ systemNotifications: on });
    await applyReminders(items, on).catch((e) => toast(String(e), 'error'));
  };
  return (
    <section className="card stack" id="horario">
      <h2 className="h2">Horario propuesto</h2>
      <p className="small muted">Horarios orientativos y editables. Los recordatorios internos se ven en Hoy ("Próximo en tu horario").</p>
      {items.map((it, i) => (
        <div key={it.id} className="row gap schedrow">
          <input type="time" aria-label={`Hora de ${it.label}`} value={it.time} onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)).sort((a, b) => a.time.localeCompare(b.time)))} />
          <input aria-label="Actividad" defaultValue={it.label} onBlur={(e) => e.target.value !== it.label && save(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <label className="switch tight" title="Aviso del sistema"><input type="checkbox" checked={it.remind} onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, remind: e.target.checked } : x)))} /><span className="small">Aviso</span></label>
          <button className="btn ghost small" aria-label={`Quitar ${it.label}`} onClick={() => save(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row gap wrap">
        <button className="btn ghost small" onClick={() => save([...items, { id: uid(), time: '12:00', label: 'Nuevo', remind: false }])}>+ Agregar</button>
        <button className="btn ghost small" onClick={() => save(DEFAULT_SCHEDULE)}>Restaurar horario inicial</button>
      </div>
      <label className="switch"><input type="checkbox" checked={s.systemNotifications} disabled={support === 'no'} onChange={(e) => toggleSystem(e.target.checked)} /><span>Avisos del sistema para los ítems marcados</span></label>
      <p className="small muted">
        {support === 'nativo' && 'En la app iOS son notificaciones locales programadas: llegan aunque la app esté cerrada.'}
        {support === 'navegador' && 'En el navegador o la app instalada desde Safari, los avisos solo funcionan mientras la app está abierta (no hay servidor de notificaciones). En iPhone, además, requiere agregarla a la pantalla de inicio.'}
        {support === 'no' && 'Este navegador no permite notificaciones.'}
      </p>
    </section>
  );
}

function TemplatesSection() {
  const tpls = useLive(getTemplates, []);
  const [sel, setSel] = useState('lunes');
  const confirm = useConfirm();
  if (!tpls) return null;
  const t = tpls.find((x) => x.id === sel)!;
  const save = (next: DayTemplate[]) => kvSet('templates', next);
  const upd = (ei: number, patch: Record<string, unknown>) => save(tpls.map((d) => (d.id !== sel ? d : { ...d, exercises: d.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) })));
  return (
    <section className="card stack" id="plantillas">
      <h2 className="h2">Plantillas de entrenamiento</h2>
      <p className="small muted">La plantilla es orientativa: tu entrenador puede adaptar ejercicios (especialmente piernas). Los cambios aplican a sesiones nuevas; las sesiones ya registradas no cambian.</p>
      <Segmented label="Día" value={sel} onChange={setSel} options={tpls.map((d) => ({ value: d.id, label: d.id[0].toUpperCase() + d.id.slice(1, 3) }))} />
      <Field label="Nombre de la sesión"><input key={t.id} defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && save(tpls.map((d) => (d.id === sel ? { ...d, name: e.target.value } : d)))} /></Field>
      {t.exercises.map((e, i) => (
        <details key={e.id} className="tpl-ex">
          <summary><b>{i + 1}. {e.name}</b> <span className="muted small">{e.sets}×{e.repMin}–{e.repMax}</span></summary>
          <div className="stack">
            <Field label="Ejercicio"><input defaultValue={e.name} onBlur={(ev) => ev.target.value !== e.name && upd(i, { name: ev.target.value })} /></Field>
            <Field label="Alternativa"><input defaultValue={e.alternative} onBlur={(ev) => ev.target.value !== e.alternative && upd(i, { alternative: ev.target.value })} /></Field>
            <div className="grid4">
              <Field label="Series"><NumInput label="Series" integer value={e.sets} min={1} max={8} onCommit={(v) => v && upd(i, { sets: v })} /></Field>
              <Field label="Reps mín"><NumInput label="Repeticiones mínimas" integer value={e.repMin} min={1} max={50} onCommit={(v) => v && upd(i, { repMin: v })} /></Field>
              <Field label="Reps máx"><NumInput label="Repeticiones máximas" integer value={e.repMax} min={1} max={50} onCommit={(v) => v && upd(i, { repMax: Math.max(v, e.repMin) })} /></Field>
              <Field label="Incremento kg"><NumInput label="Incremento mínimo disponible" value={e.incrementKg} min={0.25} max={20} onCommit={(v) => v && upd(i, { incrementKg: v })} /></Field>
            </div>
            <div className="grid2">
              <Field label="Descanso mín (s)"><NumInput label="Descanso mínimo" integer value={e.restSec[0]} min={15} max={600} onCommit={(v) => v && upd(i, { restSec: [v, Math.max(v, e.restSec[1])] })} /></Field>
              <Field label="Descanso máx (s)"><NumInput label="Descanso máximo" integer value={e.restSec[1]} min={15} max={600} onCommit={(v) => v && upd(i, { restSec: [Math.min(e.restSec[0], v), v] })} /></Field>
            </div>
            <Field label="Precaución"><input defaultValue={e.caution ?? ''} onBlur={(ev) => upd(i, { caution: ev.target.value })} /></Field>
            <Field label="Cómo hacerlo"><textarea rows={2} defaultValue={e.how} onBlur={(ev) => upd(i, { how: ev.target.value })} /></Field>
            <Field label="Errores comunes"><textarea rows={2} defaultValue={e.errors} onBlur={(ev) => upd(i, { errors: ev.target.value })} /></Field>
            <div className="row gap">
              {i > 0 && <button className="btn ghost small" onClick={() => save(tpls.map((d) => { if (d.id !== sel) return d; const ex = [...d.exercises]; [ex[i - 1], ex[i]] = [ex[i], ex[i - 1]]; return { ...d, exercises: ex }; }))}>↑ Subir</button>}
              <button className="btn ghost small" onClick={async () => { if (await confirm({ title: `Quitar ${e.name} de la plantilla?`, body: 'El historial registrado se conserva.', ok: 'Quitar', danger: true })) save(tpls.map((d) => (d.id === sel ? { ...d, exercises: d.exercises.filter((_, j) => j !== i) } : d))); }}>Quitar</button>
            </div>
          </div>
        </details>
      ))}
      <div className="row gap wrap">
        <button className="btn ghost small" onClick={() => save(tpls.map((d) => (d.id === sel ? { ...d, exercises: [...d.exercises, { id: `${sel}-${uid().slice(0, 8)}`, name: 'Nuevo ejercicio', alternative: '', sets: 2, repMin: 10, repMax: 12, restSec: [60, 90], main: false, how: '', errors: '', incrementKg: 1 }] } : d)))}>+ Agregar ejercicio</button>
        <button className="btn ghost small" onClick={async () => { if (await confirm({ title: 'Restaurar las plantillas iniciales?', body: 'Se pierden los cambios hechos a las plantillas (no el historial).', ok: 'Restaurar', danger: true })) save(DEFAULT_TEMPLATES); }}>Restaurar plantillas</button>
      </div>
    </section>
  );
}

function BackupSection() {
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const lastBackup = useLive(() => kvGet<number>('lastBackupAt'), []);
  const toast = useToast();
  const confirm = useConfirm();
  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await exportBackup();
      toast(await saveFile(blob, backupFileName()));
      await kvSet('lastBackupAt', Date.now(), true);
    } catch (e) { toast(`No se pudo exportar: ${(e as Error).message}`, 'error'); } finally { setBusy(false); }
  };
  const onFile = async (f?: File) => {
    setParsed(null); setErrors([]);
    if (!f) return;
    setBusy(true);
    const r = await parseBackup(f);
    setBusy(false);
    if (r.ok) { setParsed(r); setCounts(await currentCounts()); } else setErrors(r.errors);
  };
  const restore = async () => {
    if (!parsed) return;
    const ok = await confirm({ title: 'Reemplazar todos tus datos?', body: 'Los datos actuales de este dispositivo se reemplazan por los del respaldo. Si querés conservarlos, exportá un respaldo antes.', ok: 'Reemplazar datos', danger: true, extra: [{ label: 'Exportar actual primero', value: 'export' }] });
    if (ok === 'export') { await doExport(); return; }
    if (!ok) return;
    setBusy(true);
    try { await applyBackup(parsed); toast('Respaldo restaurado'); setParsed(null); } catch (e) { toast(`Error al restaurar: ${(e as Error).message}. No se modificó nada.`, 'error'); } finally { setBusy(false); }
  };
  return (
    <section className="card stack" id="respaldo">
      <h2 className="h2">Respaldo</h2>
      <p className="small">Un archivo ZIP con todos tus registros (data.json) y tus fotos (carpeta photos/).</p>
      <p className="small muted">Último respaldo exportado: {lastBackup ? formatDateTime(lastBackup) : 'nunca'}.</p>
      <button className="btn primary block" onClick={doExport} disabled={busy}>Exportar respaldo completo (.zip)</button>
      <Field label="Restaurar desde un respaldo" hint="Primero se valida y se muestra una vista previa. Nada se reemplaza sin tu confirmación.">
        <input type="file" accept=".zip,application/zip" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} data-testid="restore-input" />
      </Field>
      {busy && <p className="small muted">Procesando…</p>}
      {errors.length > 0 && <div className="note error" role="alert"><b>El respaldo no es válido:</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      {parsed && counts && (
        <div className="preview">
          <h3 className="h3">Vista previa del respaldo</h3>
          <p className="small">Exportado: {parsed.preview.exportedAt ? new Date(parsed.preview.exportedAt).toLocaleString('es-AR') : '¿?'} · Registros del {parsed.preview.firstDate ? formatShort(parsed.preview.firstDate) : '–'} al {parsed.preview.lastDate ? formatShort(parsed.preview.lastDate) : '–'}</p>
          <table className="tbl">
            <thead><tr><th>Datos</th><th>En el respaldo</th><th>Actual</th></tr></thead>
            <tbody>{Object.keys(LABELS).map((k) => <tr key={k}><td>{LABELS[k]}</td><td>{parsed.preview.counts[k] ?? 0}</td><td>{counts[k] ?? 0}</td></tr>)}</tbody>
          </table>
          <div className="row gap">
            <button className="btn danger grow" onClick={restore} disabled={busy}>Reemplazar mis datos con este respaldo</button>
            <button className="btn ghost" onClick={() => setParsed(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}

function PrivacySection() {
  const [est, setEst] = useState<string>('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setEst(`${((e.usage ?? 0) / 1048576).toFixed(1)} MB usados${e.quota ? ` de ~${Math.round(e.quota / 1048576)} MB disponibles` : ''}`)).catch(() => {});
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);
  return (
    <section className="card stack" id="privacidad">
      <h2 className="h2">Privacidad y almacenamiento</h2>
      <ul className="small list plain">
        <li>• Todo se guarda solo en este dispositivo (IndexedDB), incluidas las fotos. No hay cuentas, servidores ni analíticas.</li>
        <li>• <b>Los datos locales pueden perderse</b> si borrás los datos del navegador o del sitio, desinstalás la app, o si el sistema libera espacio. Exportá respaldos con frecuencia.</li>
        <li>• No hay sincronización entre dispositivos: para pasar los datos a otro, exportá y restaurá el respaldo.</li>
        <li>• Almacenamiento: {est || 'no disponible'}. {persisted == null ? '' : persisted ? 'El navegador marcó el almacenamiento como persistente.' : 'El navegador no garantiza que el almacenamiento sea persistente.'}</li>
      </ul>
      {persisted === false && <button className="btn ghost small" onClick={async () => { const p = await navigator.storage.persist?.(); setPersisted(!!p); toast(p ? 'Almacenamiento persistente activado' : 'El navegador no lo permitió (en Safari suele activarse al agregar la app a la pantalla de inicio).'); }}>Pedir almacenamiento persistente</button>}
      <button className="btn danger" onClick={async () => {
        if (!(await confirm({ title: 'Borrar todos los datos?', body: 'Se borran registros, fotos y ajustes de este dispositivo. No se puede deshacer. Exportá un respaldo antes si querés conservarlos.', ok: 'Borrar todo', danger: true }))) return;
        if (!(await confirm({ title: '¿Seguro?', body: 'Última confirmación.', ok: 'Sí, borrar todo', danger: true }))) return;
        await wipeAll(); location.hash = '#/hoy'; location.reload();
      }}>Borrar todos los datos</button>
      <p className="tiny muted">Versión web {__APP_VERSION__}. <Chip tone="gray">Sin conexión a servicios externos</Chip></p>
    </section>
  );
}
