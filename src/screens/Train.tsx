import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../App';
import { NumInput } from '../components/NumInput';
import { Chip, Field, Sheet, useConfirm, useToast } from '../components/ui';
import { PRECHECK_TEXT } from '../data/templates';
import { getSettings, patchSettings } from '../lib/app';
import { formatLong, formatShort } from '../lib/dates';
import { all, byDate, kvGet, kvSet, patchDay, put } from '../lib/db';
import { useLive, useNow } from '../lib/hooks';
import {
  describeSets, doneSets, exerciseHistory, finishStatus, fmtKg, getTemplates, newSession, programWeek,
  progressionSuggestion, templateForDate,
} from '../lib/training';
import type { DayLog, DayTemplate, ExerciseLog, ExerciseState, ExerciseTemplate, SessionStatus, WorkoutSession } from '../lib/types';

const STATUS_LABEL: Record<SessionStatus, string> = { 'en-curso': 'En curso', completada: 'Completada', incompleta: 'Incompleta', omitida: 'Omitida' };
const STATUS_TONE: Record<SessionStatus, 'green' | 'amber' | 'gray' | 'blue'> = { 'en-curso': 'blue', completada: 'green', incompleta: 'amber', omitida: 'gray' };
const SKIP_REASONS = ['Dolor o molestia', 'Rodilla inestable', 'Falta de aire', 'Indicación del entrenador', 'Máquina ocupada', 'Falta de tiempo', 'Otro'];

export function Train() {
  const { date } = useNav();
  const data = useLive(async () => {
    const [sessions, templates, settings, programStart, exStates, days, allSessions] = await Promise.all([
      byDate('sessions', date), getTemplates(), getSettings(), kvGet<string>('programStart'), all('exState'), all('days'), all('sessions'),
    ]);
    return { sessions: sessions.sort((a, b) => b.startedAt - a.startedAt), templates, settings, programStart, exStates, days, allSessions };
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

type Data = { templates: DayTemplate[]; settings: Awaited<ReturnType<typeof getSettings>>; programStart?: string; exStates: ExerciseState[]; days: DayLog[]; allSessions: WorkoutSession[]; sessions: WorkoutSession[] };

function StartPanel({ templates, settings, programStart, sessions, date, onOpen, allSessions }: Data & { date: string; onOpen: (id: string) => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const def = templateForDate(templates, date);
  const [tplId, setTplId] = useState(def?.id ?? templates[0].id);
  useEffect(() => { setTplId(def?.id ?? templates[0].id); }, [date, def?.id, templates]);
  const tpl = templates.find((t) => t.id === tplId)!;
  const week = programWeek(programStart, date);
  const [adaptation, setAdaptation] = useState(week <= settings.adaptationWeeks);
  const [reduced, setReduced] = useState(false);
  const [omitOpen, setOmitOpen] = useState(false);
  const [omitReason, setOmitReason] = useState('Descanso');
  const lastSame = allSessions.filter((s) => s.templateId === tpl.id && s.status !== 'omitida' && s.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];

  const start = async () => {
    const s = newSession(tpl, date, { adaptation, reducedSets: reduced });
    await put('sessions', s);
    onOpen(s.id);
  };
  const omit = async () => {
    const s: WorkoutSession = { ...newSession(tpl, date, { adaptation: false, reducedSets: false }), status: 'omitida', omitReason, finishedAt: Date.now() };
    await put('sessions', s);
    if (omitReason === 'Descanso' || omitReason === 'Enfermedad' || omitReason === 'Dolor') await patchDay(date, { recovery: true, recoveryReason: omitReason });
    setOmitOpen(false);
  };
  const markNoDetail = async () => {
    if (!(await confirm({ title: 'Marcar como hecho sin series', body: 'Se guarda que entrenaste, sin cargas ni repeticiones. No se usa para sugerir progresión.', ok: 'Marcar hecho' }))) return;
    const s: WorkoutSession = { ...newSession(tpl, date, { adaptation: false, reducedSets: false }), status: 'completada', noDetail: true, finishedAt: Date.now() };
    await put('sessions', s);
    toast('Entrenamiento marcado como hecho');
  };

  return (
    <>
      <section className="card hero stack">
        <p className="eyebrow">{formatLong(date)} · semana {week}</p>
        <h1 className="h1">{def ? `${tpl.name}` : 'Sin gimnasio programado'}</h1>
        {!def && <p className="muted small">Hoy no hay sesión en la plantilla (lunes a viernes). Si querés entrenar igual, elegí una.</p>}
        <Field label="Sesión">
          <select value={tplId} onChange={(e) => setTplId(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{['Dom', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sáb'][t.weekday]} — {t.name}</option>)}
          </select>
        </Field>
        <div className="note small" role="note"><b>Antes de empezar.</b> {PRECHECK_TEXT}</div>
        <label className="switch"><input type="checkbox" checked={adaptation} onChange={(e) => setAdaptation(e.target.checked)} /><span>Modo adaptación: 2 series por ejercicio{week <= settings.adaptationWeeks ? ' (sugerido en la primera semana)' : ''}</span></label>
        <label className="switch"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /><span>Reducir una serie por ejercicio hoy</span></label>
        <label className="switch"><input type="checkbox" checked={settings.repeatWeek} onChange={(e) => patchSettings({ repeatWeek: e.target.checked })} /><span>Repetir semana (mantener cargas, sin sugerencias de subir)</span></label>
        <button className="btn primary block lg" onClick={start}>Empezar sesión</button>
        <div className="row gap wrap">
          <button className="btn secondary grow" onClick={() => setOmitOpen(true)}>Omitir / descanso</button>
          <button className="btn ghost grow" onClick={markNoDetail}>Hecho sin registrar series</button>
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Ejercicios</h2>
        <ol className="exlist">
          {tpl.exercises.map((e) => (
            <li key={e.id}>
              <b>{e.name}</b> <span className="muted">{e.sets}×{e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}{e.perSide ? ' por lado' : ''}</span>
              {e.caution && <div className="small warn-text">⚠ {e.caution}</div>}
            </li>
          ))}
        </ol>
        {lastSame && <p className="small muted">Última vez: {formatShort(lastSame.date)} ({STATUS_LABEL[lastSame.status].toLowerCase()}).</p>}
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

function SessionView({ session, templates, settings, exStates, days, allSessions, onClose }: Data & { session: WorkoutSession; onClose: () => void }) {
  const confirm = useConfirm();
  const tpl = templates.find((t) => t.id === session.templateId);
  const update = (fn: (s: WorkoutSession) => WorkoutSession) => put('sessions', { ...fn(structuredClone(session)), updatedAt: Date.now() });
  const updEx = (i: number, fn: (e: ExerciseLog) => void) => update((s) => { fn(s.exercises[i]); return s; });
  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const finish = async () => {
    const st = finishStatus(session);
    if (st === 'completada') { await update((s) => ({ ...s, status: 'completada', finishedAt: Date.now() })); return; }
    const r = await confirm({
      title: 'Quedaron series sin marcar',
      body: 'Podés guardarla como incompleta (está bien) o marcarla completada si hiciste todo y no lo anotaste.',
      ok: 'Guardar como incompleta', extra: [{ label: 'Marcar completada igual', value: 'done' }], cancel: 'Seguir entrenando',
    });
    if (r === 'ok') await update((s) => ({ ...s, status: 'incompleta', finishedAt: Date.now() }));
    if (r === 'done') await update((s) => ({ ...s, status: 'completada', finishedAt: Date.now() }));
  };

  return (
    <>
      <section className="card hero stack">
        <div className="row between">
          <div>
            <p className="eyebrow">{formatLong(session.date)}</p>
            <h1 className="h1">{session.templateName}</h1>
          </div>
          <Chip tone={STATUS_TONE[session.status]}>{STATUS_LABEL[session.status]}</Chip>
        </div>
        <p className="small muted">{session.adaptation ? 'Modo adaptación · ' : ''}{session.reducedSets ? 'Series reducidas · ' : ''}Dejá normalmente 2–3 repeticiones en reserva (RIR). Las entradas en calor no cuentan como series efectivas.</p>
        <div className="note small"><b>Chequeo previo.</b> {PRECHECK_TEXT}</div>
        <div className="row gap wrap">
          <label className="switch"><input type="checkbox" checked={session.preCheck?.knee === true} onChange={(e) => update((s) => ({ ...s, preCheck: { knee: e.target.checked, breathing: s.preCheck?.breathing ?? null } }))} /><span>Rodilla estable y sin dolor</span></label>
          <label className="switch"><input type="checkbox" checked={session.preCheck?.breathing === true} onChange={(e) => update((s) => ({ ...s, preCheck: { knee: s.preCheck?.knee ?? null, breathing: e.target.checked } }))} /><span>Respiración como siempre</span></label>
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
        return <ExerciseCard key={e.exerciseId + i} e={e} t={t} hist={hist} exState={exStates.find((x) => x.exerciseId === e.exerciseId)}
          settings={settings} dayMap={dayMap} onChange={(fn) => updEx(i, fn)} editable={session.status !== 'omitida'} />;
      })}

      {session.status === 'en-curso' && (
        <section className="card stack">
          <button className="btn primary block lg" onClick={finish}>Terminar sesión</button>
          <p className="small muted center">Todo se guarda al instante. Si cerrás la app, la sesión sigue acá.</p>
        </section>
      )}
    </>
  );
}

function ExerciseCard({ e, t, hist, exState, settings, dayMap, onChange, editable }: {
  e: ExerciseLog; t?: ExerciseTemplate; hist: ReturnType<typeof exerciseHistory>; exState?: ExerciseState;
  settings: Data['settings']; dayMap: Map<string, DayLog>; onChange: (fn: (e: ExerciseLog) => void) => void; editable: boolean;
}) {
  const [skipOpen, setSkipOpen] = useState(false);
  const [reason, setReason] = useState(SKIP_REASONS[0]);
  const [skipNote, setSkipNote] = useState('');
  const [showHist, setShowHist] = useState(false);
  const last = hist[0];
  const restSec = t?.restSec ?? [60, 90];
  const done = doneSets(e).length;

  const suggestion = useMemo(() => {
    if (!last) return null;
    const d = dayMap.get(last.session.date);
    return progressionSuggestion(last.ex, hist[1]?.ex ?? null, { repeatWeek: settings.repeatWeek, dayRecoveryFeel: d?.recoveryFeel, sleepHours: d?.sleepHours, incrementKg: t?.incrementKg ?? 2.5 });
  }, [last, hist, dayMap, settings.repeatWeek, t?.incrementKg]);
  const accepted = exState?.targetKg != null;
  const dismissed = exState?.dismissedFor === last?.session.id;

  const startRest = (sec: number) => kvSet('restTimer', { endAt: Date.now() + sec * 1000, label: e.name, total: sec }, true);

  if (e.skipped) {
    return (
      <section className="card exercise skipped">
        <div className="row between"><h3 className="h3">{e.name}</h3><Chip tone="gray">Omitido</Chip></div>
        <p className="small">Motivo: {e.skipped.reason}{e.skipped.note ? ` — ${e.skipped.note}` : ''}</p>
        {editable && <button className="btn ghost small" onClick={() => onChange((x) => { x.skipped = null; })}>Deshacer omisión</button>}
      </section>
    );
  }

  return (
    <section className="card exercise">
      <div className="row between">
        <h3 className="h3">{e.name}</h3>
        <Chip tone={done >= e.plannedSets ? 'green' : 'neutral'}>{done}/{e.plannedSets} {done >= e.plannedSets ? '✓' : ''}</Chip>
      </div>
      <p className="small muted">{e.plannedSets} series × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`} reps{t?.perSide ? ' por lado' : ''} · descanso {fmtRest(restSec)}{t?.main ? ' · principal' : ''}</p>
      {t?.caution && <p className="small warn-text">⚠ {t.caution}</p>}

      <div className="lasttime">
        {last ? <><b>La última vez</b> ({formatShort(last.session.date)}): {describeSets(last.ex)}{last.ex.pain > 0 ? ` · molestia ${last.ex.pain}/10` : ''}</> : <span className="muted">Primera vez que registrás este ejercicio. Elegí una carga que te deje 2–3 repeticiones en reserva.</span>}
      </div>

      {accepted && (
        <div className="suggest accepted row between">
          <span>Objetivo aceptado: <b>{fmtKg(exState!.targetKg!)} kg</b></span>
          <span className="row gap">
            {editable && <button className="btn secondary small" onClick={() => onChange((x) => { x.sets.forEach((s) => { if (s.kg == null) s.kg = exState!.targetKg!; }); })}>Usar</button>}
            <button className="btn ghost small" onClick={() => put('exState', { exerciseId: e.exerciseId, targetKg: null, dismissedFor: last?.session.id ?? null })}>Quitar</button>
          </span>
        </div>
      )}
      {!accepted && suggestion?.suggest && !dismissed && (
        <div className="suggest">
          <p><b>Sugerencia:</b> probar <b>{fmtKg(suggestion.newKg!)} kg</b> (el mínimo disponible). {suggestion.reasons[0]}</p>
          <p className="small muted">Solo si hoy te sentís bien y sin dolor. No cambia nada hasta que aceptes.</p>
          <div className="row gap">
            <button className="btn primary small" onClick={() => put('exState', { exerciseId: e.exerciseId, targetKg: suggestion.newKg, acceptedAt: Date.now(), dismissedFor: null })}>Aceptar</button>
            <button className="btn ghost small" onClick={() => put('exState', { exerciseId: e.exerciseId, targetKg: null, dismissedFor: last!.session.id })}>Mantener carga</button>
          </div>
        </div>
      )}
      {!accepted && suggestion && !suggestion.suggest && last && <p className="small muted">Progresión: {suggestion.reasons[0]}</p>}

      {/* Entrada en calor */}
      <div className="sets">
        <p className="sets-title">Entrada en calor <span className="muted small">(no cuenta)</span></p>
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

      {/* Series efectivas */}
      <div className="sets">
        <p className="sets-title">Series efectivas</p>
        <div className="setrow head" aria-hidden="true"><span className="setn">#</span><span>kg</span><span>reps</span><span>RIR</span><span>Hecha</span></div>
        {e.sets.map((s, si) => (
          <div className={`setrow ${s.done ? 'is-done' : ''}`} key={si}>
            <span className="setn">{si + 1}</span>
            <NumInput className="kg" label={`Serie ${si + 1} kg`} placeholder={exState?.targetKg != null ? fmtKg(exState.targetKg) : 'kg'} value={s.kg} onCommit={(v) => onChange((x) => { x.sets[si].kg = v; })} />
            <NumInput className="reps" label={`Serie ${si + 1} repeticiones`} placeholder={`${e.repMin}–${e.repMax}`} integer max={100} value={s.reps} onCommit={(v) => onChange((x) => { x.sets[si].reps = v; })} />
            <select aria-label={`Serie ${si + 1} repeticiones en reserva`} value={s.rir ?? ''} onChange={(ev) => onChange((x) => { x.sets[si].rir = ev.target.value === '' ? null : Number(ev.target.value); })}>
              <option value="">–</option>{[0, 1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}{r === 5 ? '+' : ''}</option>)}
            </select>
            <button className={`btn small setdone ${s.done ? 'primary' : 'secondary'}`} aria-pressed={s.done} aria-label={`Serie ${si + 1} ${s.done ? 'hecha' : 'marcar hecha'}`}
              onClick={() => { const nd = !s.done; onChange((x) => { x.sets[si].done = nd; if (nd && x.sets[si].reps == null) x.sets[si].reps = null; }); if (nd) startRest(restSec[0]); }}>
              {s.done ? '✓' : 'Hecha'}
            </button>
          </div>
        ))}
        {editable && (
          <div className="row gap">
            <button className="btn ghost small" onClick={() => onChange((x) => { x.sets.push({ kg: x.sets.at(-1)?.kg ?? null, reps: null, rir: null, done: false }); })}>+ Serie</button>
            {e.sets.length > 1 && <button className="btn ghost small" onClick={() => onChange((x) => { x.sets.pop(); x.plannedSets = Math.min(x.plannedSets, x.sets.length); })}>− Serie</button>}
            <button className="btn ghost small" onClick={() => startRest(restSec[0])}>⏱ Descanso {fmtRest([restSec[0], restSec[0]])}</button>
          </div>
        )}
      </div>

      <div className="grid2">
        <Field label="Dolor o molestia articular (0–10)" hint="Separado del esfuerzo muscular normal.">
          <select value={e.pain} onChange={(ev) => onChange((x) => { x.pain = Number(ev.target.value); })}>
            {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n === 0 ? '0 — sin molestias' : n}</option>)}
          </select>
        </Field>
        <Field label="Técnica">
          <select value={e.techniqueOk == null ? '' : e.techniqueOk ? 'si' : 'no'} onChange={(ev) => onChange((x) => { x.techniqueOk = ev.target.value === '' ? null : ev.target.value === 'si'; })}>
            <option value="">Sin evaluar</option><option value="si">Buena</option><option value="no">Con dudas</option>
          </select>
        </Field>
      </div>
      {e.pain > 0 && (
        <>
          <Field label="¿Dónde?"><input defaultValue={e.painLocation ?? ''} onBlur={(ev) => onChange((x) => { x.painLocation = ev.target.value; })} placeholder="Ej.: rodilla derecha, muñeca" /></Field>
          <p className="note small">Con dolor, no subas carga. Podés omitir el ejercicio y registrar el motivo; no se reemplaza automáticamente por otro que cargue la misma articulación.</p>
        </>
      )}
      <Field label="Notas"><textarea rows={2} defaultValue={e.notes ?? ''} onBlur={(ev) => ev.target.value !== (e.notes ?? '') && onChange((x) => { x.notes = ev.target.value; })} /></Field>

      <details className="howto">
        <summary>Cómo hacerlo · errores comunes · alternativa</summary>
        {t ? <>
          <p><b>Cómo:</b> {t.how}</p>
          <p><b>Errores comunes:</b> {t.errors}</p>
          <p><b>Alternativa:</b> {t.alternative} <span className="muted small">(editable en Ajustes › Plantillas)</span></p>
        </> : <p className="muted">Ejercicio sin plantilla.</p>}
      </details>

      <div className="row gap wrap">
        {editable && <button className="btn ghost small" onClick={() => setSkipOpen(true)}>Omitir ejercicio</button>}
        {hist.length > 0 && <button className="btn ghost small" onClick={() => setShowHist(!showHist)}>{showHist ? 'Ocultar historial' : `Historial (${hist.length})`}</button>}
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
    <div className={`resttimer ${left <= 0 ? 'over' : ''}`} role="timer" aria-live="off">
      <div>
        <div className="small">{left > 0 ? 'Descanso' : 'Descanso cumplido'} · {t.label}</div>
        <div className="rt-time">{left > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : '¡A la próxima serie!'}</div>
      </div>
      <div className="row gap">
        <button className="btn secondary small" onClick={() => kvSet('restTimer', { ...t, endAt: Math.max(t.endAt, Date.now()) + 30000 }, true)}>+30 s</button>
        <button className="btn ghost small" onClick={() => kvSet('restTimer', null, true)}>Cerrar</button>
      </div>
    </div>
    </>
  );
}
