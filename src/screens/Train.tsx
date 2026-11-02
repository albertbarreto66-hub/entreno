import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNav } from '../App';
import { NumInput } from '../components/NumInput';
import { celebrate, Chip, Field, Sheet, useConfirm, useToast } from '../components/ui';
import { blockForWeek, isDeloadWeek, PROGRAM_WEEKS } from '../data/program';
import { PRECHECK_TEXT, videoUrl } from '../data/templates';
import { getSettings } from '../lib/app';
import { formatLong, formatShort } from '../lib/dates';
import { all, byDate, kvGet, kvSet, patchDay, put } from '../lib/db';
import { useLive, useNow } from '../lib/hooks';
import {
  describeSets, doneSets, exerciseHistory, finishStatus, fmtKg, getTemplates, newSession, programWeek, templateForDate, type DayContext,
} from '../lib/training';
import type { DayLog, DayTemplate, ExerciseLog, ExerciseTemplate, Prescription, SessionStatus, WorkoutSession } from '../lib/types';

function celebrateCenter() {
  const el = document.querySelector('.hero');
  if (el) celebrate(el);
}

const STATUS_LABEL: Record<SessionStatus, string> = { 'en-curso': 'En curso', completada: 'Completada', incompleta: 'Incompleta', omitida: 'Omitida' };
const STATUS_TONE: Record<SessionStatus, 'green' | 'amber' | 'gray' | 'blue'> = { 'en-curso': 'blue', completada: 'green', incompleta: 'amber', omitida: 'gray' };
const SKIP_REASONS = ['Dolor o molestia', 'Falta de aire', 'Pesadez o dolor en las piernas', 'Máquina ocupada', 'Falta de tiempo', 'Indicación del entrenador', 'Otro'];
const KIND_LABEL: Record<Prescription['kind'], string> = { calibracion: 'Calibración', subir: '↑ Subís carga', repetir: 'Mantener', 'mas-reps': '+1 repetición', bajar: '↓ Bajamos', descarga: 'Descarga' };

export function Train() {
  const { date } = useNav();
  const data = useLive(async () => {
    const [sessions, templates, settings, programStart, days, allSessions] = await Promise.all([
      byDate('sessions', date), getTemplates(), getSettings(), kvGet<string>('programStart'), all('days'), all('sessions'),
    ]);
    return { sessions: sessions.sort((a, b) => b.startedAt - a.startedAt), templates, settings, programStart, days, allSessions };
  }, [date]);
  const [viewId, setViewId] = useState<string | null>(null);
  if (!data) return null;
  const { sessions } = data;
  const current = sessions.find((s) => s.id === viewId) ?? sessions.find((s) => s.status === 'en-curso') ?? null;

  return (
    <div className="stack-lg">
      {current ? (
        <SessionView session={current} {...data} onClose={() => setViewId('__none__')} />
      ) : (
        <StartPanel {...data} date={date} onOpen={setViewId} />
      )}
      <RestTimer />
    </div>
  );
}

type Data = { templates: DayTemplate[]; settings: Awaited<ReturnType<typeof getSettings>>; programStart?: string; days: DayLog[]; allSessions: WorkoutSession[]; sessions: WorkoutSession[] };

export function rxSummary(t: Prescription | null | undefined, perSide?: boolean) {
  if (!t) return '';
  const reps = `${t.reps}${perSide ? ' por lado' : ''}`;
  return `${t.sets} × ${reps}${t.kg != null ? ` · ${fmtKg(t.kg)} kg` : ' · peso a calibrar'} · RIR ${t.rir}`;
}

function dayContext(days: DayLog[], date: string): DayContext {
  const d = days.find((x) => x.date === date);
  return { recoveryFeel: d?.recoveryFeel, sleepHours: d?.sleepHours, pain: d?.pain };
}

function StartPanel({ templates, programStart, sessions, date, onOpen, allSessions, days }: Data & { date: string; onOpen: (id: string) => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const def = templateForDate(templates, date);
  const [tplId, setTplId] = useState(def?.id ?? templates[0].id);
  useEffect(() => { setTplId(def?.id ?? templates[0].id); }, [date, def?.id, templates]);
  const tpl = templates.find((t) => t.id === tplId)!;
  const week = programWeek(programStart, date);
  const block = blockForWeek(week);
  const [reduced, setReduced] = useState(false);
  const [omitOpen, setOmitOpen] = useState(false);
  const [omitReason, setOmitReason] = useState('Descanso');
  const previous = allSessions.filter((s) => s.date < date || s.status !== 'en-curso');
  const preview = useMemo(() => newSession(tpl, date, { week, reducedSets: reduced, history: previous, dayContext: dayContext(days, date) }), [tpl, date, week, reduced, previous, days]);
  const totalSets = preview.exercises.reduce((a, e) => a + e.plannedSets, 0);
  const minutes = Math.round(preview.exercises.reduce((a, e) => a + e.plannedSets * ((e.target?.restSec ?? 90) + 45), 0) / 60 + 8);

  const start = async () => {
    const s = newSession(tpl, date, { week, reducedSets: reduced, history: previous, dayContext: dayContext(days, date) });
    await put('sessions', s);
    onOpen(s.id);
  };
  const omit = async () => {
    const s: WorkoutSession = { ...newSession(tpl, date, { week }), status: 'omitida', omitReason, finishedAt: Date.now() };
    await put('sessions', s);
    if (omitReason === 'Descanso' || omitReason === 'Enfermedad' || omitReason === 'Dolor') await patchDay(date, { recovery: true, recoveryReason: omitReason });
    setOmitOpen(false);
  };
  const markNoDetail = async () => {
    if (!(await confirm({ title: 'Marcar como hecho sin series', body: 'Se guarda que entrenaste, sin cargas ni repeticiones. Sin datos, la app no puede calcular tus kilos de la próxima sesión.', ok: 'Marcar hecho' }))) return;
    const s: WorkoutSession = { ...newSession(tpl, date, { week }), status: 'completada', noDetail: true, finishedAt: Date.now() };
    await put('sessions', s);
    toast('Entrenamiento marcado como hecho');
  };

  return (
    <>
      <section className="card hero stack">
        <div className="row between"><p className="eyebrow">{formatLong(date)}</p><Chip tone="green">Semana {Math.min(week, PROGRAM_WEEKS)} de {PROGRAM_WEEKS}</Chip></div>
        <h1 className="h1">{def ? tpl.name : 'Sin gimnasio programado'}</h1>
        <p className="muted small">Bloque {block.n}: {block.name}{isDeloadWeek(week) ? ' · semana de descarga' : ''} · {preview.exercises.length} ejercicios · {totalSets} series · ≈ {minutes} min</p>
        {!def && <p className="muted small">Hoy no hay sesión en el programa (lunes a viernes). Si querés entrenar igual, elegí una.</p>}
        <Field label="Sesión">
          <select value={tplId} onChange={(e) => setTplId(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{['Dom', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sáb'][t.weekday]} — {t.name}</option>)}
          </select>
        </Field>
        <div className="note small" role="note">{PRECHECK_TEXT}</div>
        <p className="small"><b>La app ya calculó tu sesión:</b> {totalSets} series en total, con repeticiones, kilos y descansos según la semana {Math.min(week, PROGRAM_WEEKS)} del programa. Solo seguilas.</p>
        <button className="btn primary block lg" onClick={start}>Empezar entrenamiento</button>
        <details className="opts">
          <summary>Solo si hoy no estás bien</summary>
          <label className="switch"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /><span>Una serie menos por ejercicio (enfermedad, mal descanso o dolor)</span></label>
        </details>
        <div className="row gap wrap">
          <button className="btn secondary grow" onClick={() => setOmitOpen(true)}>Omitir / descanso</button>
          <button className="btn ghost grow" onClick={markNoDetail}>Hecho sin registrar series</button>
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Lo que te toca hoy</h2>
        <ol className="rxlist">
          {preview.exercises.map((e, i) => {
            const t = tpl.exercises.find((x) => x.id === e.exerciseId)!;
            return (
              <li key={e.exerciseId}>
                <span className="ex-num" aria-hidden="true">{i + 1}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between gap"><b>{e.name}</b><a className="yt" href={videoUrl(t.video)} target="_blank" rel="noopener noreferrer" aria-label={`Ver cómo se hace ${e.name} en YouTube`}>▶ Video</a></div>
                  <div className="small muted">{t.muscle}</div>
                  <div className="rx-line">{rxSummary(e.target, t.perSide)} <span className={`rx-kind k-${e.target?.kind}`}>{e.target ? KIND_LABEL[e.target.kind] : ''}</span></div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="tiny muted">Los kilos salen de tu historial: si completás todas las series en el tope del rango, sin dolor y con margen, la próxima vez la app sube el peso mínimo disponible. Los videos abren una búsqueda en YouTube.</p>
      </section>

      {sessions.length > 0 && (
        <section className="card">
          <h2 className="h2">Registros de este día</h2>
          <ul className="list">
            {sessions.map((s) => (
              <li key={s.id} className="row between">
                <span>{s.templateName} <Chip tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Chip>{s.noDetail && <span className="small muted"> sin series</span>}{s.omitReason && <span className="small muted"> · {s.omitReason}</span>}</span>
                {!s.noDetail && s.status !== 'omitida' && <button className="btn ghost small" onClick={() => onOpen(s.id)}>Ver / editar</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={omitOpen} onClose={() => setOmitOpen(false)} title="Omitir sesión">
        <p className="muted small">Registrar descanso no es fallar: queda anotado para entender tu semana.</p>
        <Field label="Motivo">
          <select value={omitReason} onChange={(e) => setOmitReason(e.target.value)}>
            {['Descanso', 'Enfermedad', 'Dolor', 'Falta de aire', 'Trabajo / tiempo', 'Otro'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <button className="btn primary block" onClick={omit}>Guardar como omitida</button>
      </Sheet>
    </>
  );
}

const exDone = (e: ExerciseLog) => !!e.skipped || doneSets(e).length >= e.plannedSets;

function SessionView({ session, templates, allSessions, onClose }: Data & { session: WorkoutSession; onClose: () => void }) {
  const confirm = useConfirm();
  const tpl = templates.find((t) => t.id === session.templateId);
  const update = (fn: (s: WorkoutSession) => WorkoutSession) => put('sessions', { ...fn(structuredClone(session)), updatedAt: Date.now() });
  const updEx = (i: number, fn: (e: ExerciseLog) => void) => update((s) => { fn(s.exercises[i]); return s; });
  const currentIdx = session.exercises.findIndex((e) => !exDone(e));
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const prevCurrent = useRef(currentIdx);
  useEffect(() => {
    // Al terminar un ejercicio, llevar la vista al siguiente.
    if (currentIdx !== prevCurrent.current && currentIdx >= 0) {
      setTimeout(() => document.getElementById(`ex-${currentIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    }
    prevCurrent.current = currentIdx;
  }, [currentIdx]);
  const totalSets = session.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.plannedSets), 0);
  const done = session.exercises.reduce((a, e) => a + (e.skipped ? 0 : Math.min(doneSets(e).length, e.plannedSets)), 0);
  const pct = totalSets ? Math.round((done / totalSets) * 100) : 0;
  const elapsed = Math.round((Date.now() - session.startedAt) / 60000);

  const finish = async () => {
    const st = finishStatus(session);
    if (st === 'completada') { await update((s) => ({ ...s, status: 'completada', finishedAt: Date.now() })); celebrateCenter(); return; }
    const r = await confirm({
      title: 'Quedaron series sin marcar',
      body: 'Podés guardarla como incompleta (está bien) o marcarla completada si hiciste todo y no lo anotaste.',
      ok: 'Guardar como incompleta', extra: [{ label: 'Marcar completada igual', value: 'done' }], cancel: 'Seguir entrenando',
    });
    if (r === 'ok') await update((s) => ({ ...s, status: 'incompleta', finishedAt: Date.now() }));
    if (r === 'done') { await update((s) => ({ ...s, status: 'completada', finishedAt: Date.now() })); celebrateCenter(); }
  };

  return (
    <>
      <section className="card hero stack">
        <div className="row between">
          <p className="eyebrow">{formatLong(session.date)}{session.week ? ` · semana ${session.week}` : ''}</p>
          <Chip tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</Chip>
        </div>
        <h1 className="h1">{session.templateName}</h1>
        <div className="session-progress" aria-label={`Progreso: ${done} de ${totalSets} series`}>
          <div className="row between small"><span><b>{done}</b> de {totalSets} series{currentIdx >= 0 ? ` · ejercicio ${currentIdx + 1} de ${session.exercises.length}` : ' · ¡todo hecho!'}</span><span>{session.status === 'en-curso' ? `${elapsed} min` : ''}</span></div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
        {session.blockName && <p className="small muted">Bloque: {session.blockName}{session.deload ? ' · descarga' : ''}. Dejá las repeticiones en reserva que indica cada ejercicio: no hace falta llegar al fallo.</p>}
        <div className="row gap wrap">
          <label className="switch"><input type="checkbox" checked={session.preCheck?.breathing === true} onChange={(e) => update((s) => ({ ...s, preCheck: { knee: s.preCheck?.knee ?? null, breathing: e.target.checked } }))} /><span>Respiración como siempre</span></label>
          <label className="switch"><input type="checkbox" checked={session.preCheck?.knee === true} onChange={(e) => update((s) => ({ ...s, preCheck: { knee: e.target.checked, breathing: s.preCheck?.breathing ?? null } }))} /><span>Piernas sin pesadez ni dolor</span></label>
        </div>
        {session.status !== 'en-curso' && session.status !== 'omitida' && (
          <div className="row gap wrap">
            <button className="btn secondary" onClick={() => update((s) => ({ ...s, status: 'en-curso' }))}>Reabrir sesión</button>
            <button className="btn ghost" onClick={onClose}>Volver</button>
          </div>
        )}
      </section>

      {session.exercises.map((e, i) => {
        const t = tpl?.exercises.find((x) => x.id === e.exerciseId);
        const hist = exerciseHistory(allSessions, e.exerciseId, e.name, session.id).filter((h) => h.session.date <= session.date);
        const state = exDone(e) ? 'done' : i === currentIdx ? 'current' : 'next';
        const expanded = open[i] ?? state === 'current';
        return <ExerciseCard key={e.exerciseId + i} index={i} e={e} t={t} hist={hist} state={state} expanded={expanded}
          onToggle={() => setOpen((o) => ({ ...o, [i]: !expanded }))} onChange={(fn) => updEx(i, fn)} editable={session.status !== 'omitida'} />;
      })}

      {session.status === 'en-curso' && (
        <section className="card stack">
          <button className="btn primary block lg" onClick={finish}>Finalizar entrenamiento</button>
          <p className="small muted center">La sesión solo termina cuando tocás este botón. Todo se guarda al instante: si cerrás la app, sigue acá.</p>
        </section>
      )}
    </>
  );
}

function ExerciseCard({ e, index, t, hist, state, expanded, onToggle, onChange, editable }: {
  e: ExerciseLog; index: number; t?: ExerciseTemplate; hist: ReturnType<typeof exerciseHistory>; state: 'done' | 'current' | 'next'; expanded: boolean;
  onToggle: () => void; onChange: (fn: (e: ExerciseLog) => void) => void; editable: boolean;
}) {
  const [skipOpen, setSkipOpen] = useState(false);
  const [reason, setReason] = useState(SKIP_REASONS[0]);
  const [skipNote, setSkipNote] = useState('');
  const [showHist, setShowHist] = useState(false);
  const toast = useToast();
  const last = hist[0];
  const rx = e.target;
  const restSec = rx?.restSec ?? t?.restSec[0] ?? 90;
  const done = doneSets(e).length;
  const startRest = (sec: number) => kvSet('restTimer', { endAt: Date.now() + sec * 1000, label: e.name, total: sec }, true);

  const markSet = (si: number) => {
    const s = e.sets[si];
    const nd = !s.done;
    if (nd && s.kg == null && rx?.kg == null) { toast('Anotá los kg que usaste en esta serie', 'error'); return; }
    onChange((x) => {
      const cur = x.sets[si];
      if (nd) {
        if (cur.kg == null && rx?.kg != null) cur.kg = rx.kg;
        if (cur.reps == null && rx) cur.reps = rx.reps;
        if (cur.rir == null && rx) cur.rir = rx.rir;
        // las series siguientes vacías toman el peso usado
        for (let k = si + 1; k < x.sets.length; k++) if (x.sets[k].kg == null && !x.sets[k].done) x.sets[k].kg = cur.kg;
      }
      cur.done = nd;
    });
    if (nd && si < e.sets.length - 1) startRest(restSec);
    if (nd && si === e.sets.length - 1) toast(`✓ ${e.name} terminado`);
  };

  const head = (
    <div className="ex-head" onClick={state !== 'current' || !expanded ? onToggle : undefined} role={state !== 'current' ? 'button' : undefined} aria-expanded={expanded}>
      <span className="ex-num" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row between gap">
          <h3 className="h3">{e.name}</h3>
          <Chip tone={e.skipped ? 'gray' : done >= e.plannedSets ? 'green' : 'neutral'}>{e.skipped ? 'Omitido' : `${done}/${e.plannedSets}`}</Chip>
        </div>
        <div className="small muted">{state === 'done' && !e.skipped ? describeSets(e) : `${t?.muscle ?? ''}${rx ? ` · ${rxSummary(rx, t?.perSide)}` : ''}`}</div>
        {!e.skipped && <div className="ex-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, (done / Math.max(1, e.plannedSets)) * 100)}%` }} /></div>}
      </div>
    </div>
  );

  if (!expanded) return <section id={`ex-${index}`} className={`card exercise collapsed s-${state}`}>{head}</section>;

  if (e.skipped) {
    return (
      <section id={`ex-${index}`} className="card exercise skipped">
        {head}
        <p className="small">Motivo: {e.skipped.reason}{e.skipped.note ? ` — ${e.skipped.note}` : ''}</p>
        {editable && <button className="btn ghost small" onClick={() => onChange((x) => { x.skipped = null; })}>Deshacer omisión</button>}
      </section>
    );
  }

  const warm = rx?.kg != null && t?.main ? [Math.round(rx.kg * 0.5), Math.round(rx.kg * 0.75)] : null;
  return (
    <section id={`ex-${index}`} className={`card exercise s-${state}`}>
      {head}
      {t && <a className="btn ghost small yt-btn" href={videoUrl(t.video)} target="_blank" rel="noopener noreferrer">▶ Ver cómo se hace (YouTube)</a>}

      {rx && (
        <div className={`rx-box k-${rx.kind}`}>
          <div className="row between gap"><b>Hoy: {rxSummary(rx, t?.perSide)}</b><span className="rx-kind">{KIND_LABEL[rx.kind]}</span></div>
          <p className="small">{rx.note}</p>
          <p className="tiny muted">Descanso entre series: {fmtRest([restSec, restSec])} · rango del ejercicio {rx.repMin}–{rx.repMax} reps</p>
        </div>
      )}
      {t?.caution && <p className="small warn-text">⚠ {t.caution}</p>}
      <div className="lasttime">
        {last ? <><b>La última vez</b> ({formatShort(last.session.date)}): {describeSets(last.ex)}{last.ex.pain > 0 ? ` · molestia ${last.ex.pain}/10` : ''}</> : <span className="muted">Primera vez con este ejercicio.</span>}
      </div>

      <div className="sets">
        <p className="sets-title">Entrada en calor <span className="muted small">(no cuenta)</span></p>
        {warm && <p className="small muted">Sugerido: 1 × 10 con ~{warm[0]} kg y 1 × 5 con ~{warm[1]} kg.</p>}
        {e.warmups.map((w, wi) => (
          <div className="setrow warm" key={'w' + wi}>
            <span className="setn">C{wi + 1}</span>
            <NumInput className="kg" label={`Calentamiento ${wi + 1} kg`} placeholder="kg" value={w.kg} onCommit={(v) => onChange((x) => { x.warmups[wi].kg = v; })} />
            <NumInput className="reps" label={`Calentamiento ${wi + 1} repeticiones`} placeholder="reps" integer value={w.reps} onCommit={(v) => onChange((x) => { x.warmups[wi].reps = v; })} />
            <button className="btn ghost small" aria-label="Quitar calentamiento" onClick={() => onChange((x) => { x.warmups.splice(wi, 1); })}>✕</button>
          </div>
        ))}
        {editable && <button className="btn ghost small" onClick={() => onChange((x) => { x.warmups.push({ kg: null, reps: null }); })}>+ Serie de calentamiento</button>}
      </div>

      <div className="sets">
        <p className="sets-title">Series efectivas</p>
        <div className="setrow head" aria-hidden="true"><span className="setn">#</span><span>kg</span><span>reps</span><span>RIR</span><span>Hecha</span></div>
        {e.sets.map((s, si) => {
          const isNext = !s.done && e.sets.findIndex((x) => !x.done) === si;
          return (
            <div className={`setrow ${s.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`} key={si}>
              <span className="setn">{si + 1}</span>
              <NumInput className="kg" label={`Serie ${si + 1} kg`} placeholder={rx?.kg != null ? fmtKg(rx.kg) : 'kg'} value={s.kg} onCommit={(v) => onChange((x) => { x.sets[si].kg = v; })} />
              <NumInput className="reps" label={`Serie ${si + 1} repeticiones`} placeholder={rx ? String(rx.reps) : `${e.repMin}–${e.repMax}`} integer max={100} value={s.reps} onCommit={(v) => onChange((x) => { x.sets[si].reps = v; })} />
              <select aria-label={`Serie ${si + 1} repeticiones en reserva`} value={s.rir ?? ''} onChange={(ev) => onChange((x) => { x.sets[si].rir = ev.target.value === '' ? null : Number(ev.target.value); })}>
                <option value="">{rx ? `${rx.rir}` : '–'}</option>{[0, 1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}{r === 5 ? '+' : ''}</option>)}
              </select>
              <button className={`btn small setdone ${s.done ? 'primary' : 'secondary'}`} aria-pressed={s.done} aria-label={`Serie ${si + 1} ${s.done ? 'hecha' : 'marcar hecha'}`} onClick={() => markSet(si)}>
                {s.done ? '✓' : 'Hecha'}
              </button>
            </div>
          );
        })}
        <p className="tiny muted">Series calculadas por la app. "Hecha" completa los casilleros vacíos con lo indicado; si hiciste otra cosa, cambiá los números.</p>
        {editable && <button className="btn ghost small" onClick={() => startRest(restSec)}>⏱ Descanso {fmtRest([restSec, restSec])}</button>}
      </div>

      <div className="grid2">
        <Field label="Dolor o molestia articular (0–10)" hint="Separado del esfuerzo muscular normal.">
          <select value={e.pain} onChange={(ev) => onChange((x) => { x.pain = Number(ev.target.value); })}>
            {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n === 0 ? '0 — sin molestias' : n}</option>)}
          </select>
        </Field>
        <Field label="Técnica">
          <select value={e.techniqueOk == null ? '' : e.techniqueOk ? 'si' : 'no'} onChange={(ev) => onChange((x) => { x.techniqueOk = ev.target.value === '' ? null : ev.target.value === 'si'; })}>
            <option value="">Bien (por defecto)</option><option value="si">Muy buena</option><option value="no">Con dudas: no subir</option>
          </select>
        </Field>
      </div>
      {e.pain > 0 && (
        <>
          <Field label="¿Dónde?"><input defaultValue={e.painLocation ?? ''} onBlur={(ev) => onChange((x) => { x.painLocation = ev.target.value; })} placeholder="Ej.: rodilla derecha, muñeca" /></Field>
          <p className="note small">Con dolor, la próxima sesión la app no sube carga (y con 4/10 o más la baja un 10 %). Podés omitir el ejercicio y anotar el motivo.</p>
        </>
      )}
      <Field label="Notas"><textarea rows={2} defaultValue={e.notes ?? ''} onBlur={(ev) => ev.target.value !== (e.notes ?? '') && onChange((x) => { x.notes = ev.target.value; })} /></Field>

      <details className="howto">
        <summary>Cómo hacerlo · errores comunes · alternativa</summary>
        {t ? <>
          <p><b>Músculo:</b> {t.muscle}</p>
          <p><b>Cómo:</b> {t.how}</p>
          <p><b>Errores comunes:</b> {t.errors}</p>
          <p><b>Alternativa:</b> {t.alternative} <span className="muted small">(editable en Ajustes › Plantillas)</span></p>
        </> : <p className="muted">Ejercicio sin plantilla.</p>}
      </details>

      <div className="row gap wrap">
        {editable && <button className="btn ghost small" onClick={() => setSkipOpen(true)}>Omitir ejercicio</button>}
        {hist.length > 0 && <button className="btn ghost small" onClick={() => setShowHist(!showHist)}>{showHist ? 'Ocultar historial' : `Historial (${hist.length})`}</button>}
        {state === 'done' && <button className="btn ghost small" onClick={onToggle}>Cerrar</button>}
      </div>
      {showHist && (
        <ul className="list small">
          {hist.slice(0, 12).map((h) => <li key={h.session.id}><b>{formatShort(h.session.date)}</b> {describeSets(h.ex)}{h.ex.pain ? ` · molestia ${h.ex.pain}/10` : ''}</li>)}
        </ul>
      )}

      <Sheet open={skipOpen} onClose={() => setSkipOpen(false)} title={`Omitir: ${e.name}`}>
        <Field label="Motivo"><select value={reason} onChange={(ev) => setReason(ev.target.value)}>{SKIP_REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Detalle (opcional)"><input value={skipNote} onChange={(ev) => setSkipNote(ev.target.value)} /></Field>
        <button className="btn primary block" onClick={() => { onChange((x) => { x.skipped = { reason, note: skipNote }; }); setSkipOpen(false); }}>Omitir y registrar motivo</button>
      </Sheet>
    </section>
  );
}

function fmtRest([a, b]: [number, number]) {
  const f = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);
  return a === b ? f(a) : `${f(a)}–${f(b)}`;
}

/** Temporizador de descanso: guarda la hora de fin, así sobrevive a recargas. */
function RestTimer() {
  const t = useLive(() => kvGet<{ endAt: number; label: string; total: number } | null>('restTimer'), []);
  const now = useNow(500);
  const [notified, setNotified] = useState<number | null>(null);
  const left = t ? Math.ceil((t.endAt - now) / 1000) : 0;
  useEffect(() => {
    if (t && left <= 0 && notified !== t.endAt) {
      setNotified(t.endAt);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ }
    }
  }, [left, t, notified]);
  if (!t || left < -30) return null;
  const mm = Math.floor(Math.max(0, left) / 60), ss = Math.max(0, left) % 60;
  return (
    <>
    <div className="rt-spacer" aria-hidden="true" />
    {createPortal(
    <div className={`resttimer ${left <= 0 ? 'over' : ''}`} role="timer" aria-live="off">
      <div className="rt-left">
        <svg className="rt-ring" viewBox="0 0 54 54" aria-hidden="true">
          <circle className="bg" cx="27" cy="27" r="23" />
          <circle className="fg" cx="27" cy="27" r="23" strokeDasharray={2 * Math.PI * 23} strokeDashoffset={2 * Math.PI * 23 * (1 - Math.max(0, Math.min(1, left / (t.total || 1))))} />
        </svg>
        <div style={{ minWidth: 0 }}>
          <div className="small" style={{ opacity: .8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{left > 0 ? 'Descanso' : 'Descanso cumplido'} · {t.label}</div>
          <div className="rt-time">{left > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : '¡A la próxima serie!'}</div>
        </div>
      </div>
      <div className="row gap">
        <button className="btn secondary small" onClick={() => kvSet('restTimer', { ...t, endAt: Math.max(t.endAt, Date.now()) + 30000 }, true)}>+30 s</button>
        <button className="btn ghost small" onClick={() => kvSet('restTimer', null, true)}>Cerrar</button>
      </div>
    </div>, document.body)}
    </>
  );
}
