import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseAnim } from '../components/ExerciseAnim';
import { IconChevron, IconClose, IconList, IconMinus, IconPlay, IconPlus } from '../components/icons';
import { Sheet, useToast } from '../components/ui';
import { videoUrl } from '../data/templates';
import { formatShort } from '../lib/dates';
import { kvGet, kvSet } from '../lib/db';
import { useLive, useNow } from '../lib/hooks';
import { describeSets, doneSets, exerciseHistory, fmtKg } from '../lib/training';
import type { DayTemplate, ExerciseLog, Prescription, WorkoutSession } from '../lib/types';

const KIND: Record<Prescription['kind'], string> = { calibracion: 'Calibración', subir: 'Subís carga', repetir: 'Mantener', 'mas-reps': '+1 repetición', bajar: 'Bajamos carga', descarga: 'Descarga' };
const exDone = (e: ExerciseLog) => !!e.skipped || doneSets(e).length >= e.plannedSets;
const parseKg = (s: string) => { const n = Number(s.replace(',', '.')); return s.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 999 ? n : null; };
export type RestState = { endAt: number; label: string; total: number; next?: string } | null;

/**
 * Modo entrenamiento a pantalla completa: un ejercicio a la vez, la figura animada, lo que indica
 * el programa ya cargado, botones grandes para ajustar y "Serie hecha". El descanso ocupa la pantalla.
 */
export function Player({ session, tpl, allSessions, onClose, onChangeEx, onFinish }: {
  session: WorkoutSession; tpl?: DayTemplate; allSessions: WorkoutSession[];
  onClose: () => void; onChangeEx: (i: number, fn: (e: ExerciseLog) => void) => Promise<unknown>; onFinish: () => void;
}) {
  const toast = useToast();
  const firstOpen = Math.max(0, session.exercises.findIndex((e) => !exDone(e)));
  const [idx, setIdx] = useState(firstOpen);
  const [how, setHow] = useState(false);
  const allDone = session.exercises.every(exDone);
  const e = session.exercises[Math.min(idx, session.exercises.length - 1)];
  const t = tpl?.exercises.find((x) => x.id === e.exerciseId);
  const rx = e.target;
  const si = e.sets.findIndex((s) => !s.done);
  const lastDone = [...e.sets].reverse().find((s) => s.done);
  const key = `${idx}-${si}`;
  const initKg = (si >= 0 ? e.sets[si].kg : null) ?? lastDone?.kg ?? rx?.kg ?? null;
  const [kgText, setKgText] = useState(initKg != null ? fmtKg(initKg) : '');
  const [reps, setReps] = useState((si >= 0 ? e.sets[si].reps : null) ?? rx?.reps ?? e.repMax);
  const [rir, setRir] = useState((si >= 0 ? e.sets[si].rir : null) ?? rx?.rir ?? 2);
  useEffect(() => {
    setKgText(initKg != null ? fmtKg(initKg) : '');
    setReps((si >= 0 ? e.sets[si].reps : null) ?? rx?.reps ?? e.repMax);
    setRir((si >= 0 ? e.sets[si].rir : null) ?? rx?.rir ?? 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    document.body.classList.add('noscroll', 'in-player');
    return () => document.body.classList.remove('noscroll', 'in-player');
  }, []);

  const step = t?.incrementKg ?? 2.5;
  const restSec = rx?.restSec ?? t?.restSec[0] ?? 90;
  const last = exerciseHistory(allSessions, e.exerciseId, e.name, session.id).filter((h) => h.session.date <= session.date)[0];
  const startRest = (sec: number, label: string, next: string) => kvSet('restTimer', { endAt: Date.now() + sec * 1000, label, total: sec, next }, true);

  const bumpKg = (d: number) => {
    const cur = parseKg(kgText) ?? rx?.kg ?? 0;
    setKgText(fmtKg(Math.max(0, Math.round((cur + d) * 100) / 100)));
  };

  const done = async () => {
    const kg = parseKg(kgText);
    if (kg == null) { toast('Anotá los kg que usaste en esta serie', 'error'); return; }
    await onChangeEx(idx, (x) => {
      const c = x.sets[si];
      Object.assign(c, { kg, reps, rir, done: true });
      for (let k = si + 1; k < x.sets.length; k++) if (x.sets[k].kg == null && !x.sets[k].done) x.sets[k].kg = kg;
    });
    try { navigator.vibrate?.(30); } catch { /* sin vibración */ }
    const moreSets = si < e.sets.length - 1;
    if (moreSets) { startRest(restSec, e.name, `Serie ${si + 2} de ${e.plannedSets}`); return; }
    const nextIdx = session.exercises.findIndex((x, i) => i !== idx && !exDone(x));
    if (nextIdx >= 0) {
      setIdx(nextIdx);
      startRest(restSec, e.name, `Próximo: ${session.exercises[nextIdx].name}`);
    }
  };

  const totalSets = session.exercises.reduce((a, x) => a + (x.skipped ? 0 : x.plannedSets), 0);
  const setsDone = session.exercises.reduce((a, x) => a + (x.skipped ? 0 : Math.min(doneSets(x).length, x.plannedSets)), 0);

  return createPortal(
    <div className="player" role="dialog" aria-modal="true" aria-label="Modo entrenamiento">
      <header className="pl-top">
        <button className="pl-icon" onClick={onClose} aria-label="Ver lista de ejercicios"><IconList /></button>
        <div className="pl-segs" aria-label={`${setsDone} de ${totalSets} series`}>
          {session.exercises.map((x, i) => (
            <button key={i} className={`pl-seg ${exDone(x) ? 'done' : ''} ${i === idx && !allDone ? 'on' : ''}`} aria-label={`Ir a ${x.name}`} onClick={() => setIdx(i)}>
              <i style={{ width: `${x.skipped ? 100 : Math.min(100, (doneSets(x).length / Math.max(1, x.plannedSets)) * 100)}%` }} />
            </button>
          ))}
        </div>
        <span className="pl-count">{setsDone}/{totalSets}</span>
      </header>

      {allDone ? (
        <div className="pl-finish">
          <ExerciseAnim ex={{ name: 'caminata' }} size={220} />
          <p className="eyebrow">Sesión completa</p>
          <h1 className="pl-name">{totalSets} series hechas</h1>
          <p className="muted">Todo quedó guardado. Cerrala para que cuente en tu semana.</p>
          <button className="btn primary block lg" onClick={onFinish}>Finalizar entrenamiento</button>
          <button className="btn ghost block" onClick={onClose}>Ver lista</button>
        </div>
      ) : (
        <>
          <div className="pl-stage">
            <ExerciseAnim ex={{ id: e.exerciseId, name: e.name }} size={330} className="pl-fig" />
            {t && <span className="pl-muscle">{t.muscle}</span>}
            <div className="pl-nav">
              <button className="pl-icon" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Ejercicio anterior"><IconChevron dir="left" /></button>
              <button className="pl-icon" disabled={idx >= session.exercises.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Ejercicio siguiente"><IconChevron /></button>
            </div>
          </div>

          <div className="pl-body">
            <p className="eyebrow">Ejercicio {idx + 1} de {session.exercises.length}{rx ? ` · ${KIND[rx.kind]}` : ''}</p>
            <h1 className="pl-name">{e.name}</h1>
            {exDone(e) ? (
              <div className="pl-donebox">
                <p><b>{e.skipped ? `Omitido: ${e.skipped.reason}` : 'Hecho'}</b></p>
                {!e.skipped && <p className="small muted">{describeSets(e)}</p>}
                <button className="btn secondary block" onClick={() => setIdx(Math.max(0, session.exercises.findIndex((x) => !exDone(x))))}>Ir al que sigue</button>
              </div>
            ) : (
              <>
                <div className="pl-setline">
                  <span className="pl-set">Serie {si + 1}<small> / {e.plannedSets}</small></span>
                  <span className="pl-target">{rx?.kg != null ? `${fmtKg(rx.kg)} kg` : 'Calibrar'} × {rx?.reps ?? `${e.repMin}–${e.repMax}`}{t?.perSide ? ' por lado' : ''} · RIR {rx?.rir ?? 2}</span>
                </div>
                <div className="pl-dots" aria-hidden="true">{e.sets.map((s, i) => <i key={i} className={s.done ? 'done' : i === si ? 'on' : ''} />)}</div>

                <div className="pl-steppers">
                  <div className="stepper">
                    <span className="stepper-label">Kilos</span>
                    <div className="stepper-row">
                      <button onClick={() => bumpKg(-step)} aria-label="Restar kilos"><IconMinus /></button>
                      <input aria-label="Kilos" inputMode="decimal" value={kgText} placeholder="—" onChange={(ev) => setKgText(ev.target.value)} />
                      <button onClick={() => bumpKg(step)} aria-label="Sumar kilos"><IconPlus /></button>
                    </div>
                  </div>
                  <div className="stepper">
                    <span className="stepper-label">Reps</span>
                    <div className="stepper-row">
                      <button onClick={() => setReps(Math.max(0, reps - 1))} aria-label="Restar repetición"><IconMinus /></button>
                      <output aria-label="Repeticiones">{reps}</output>
                      <button onClick={() => setReps(Math.min(100, reps + 1))} aria-label="Sumar repetición"><IconPlus /></button>
                    </div>
                  </div>
                </div>
                <div className="pl-rir" role="radiogroup" aria-label="Repeticiones en reserva">
                  <span className="stepper-label">En reserva</span>
                  {[0, 1, 2, 3, 4].map((r) => <button key={r} role="radio" aria-checked={rir === r} className={rir === r ? 'on' : ''} onClick={() => setRir(r)}>{r}{r === 4 ? '+' : ''}</button>)}
                </div>
                {rx?.kind === 'calibracion' && <p className="pl-hint">Primera vez en la app: elegí el peso con el que llegás a {rx.reps} reps dejando {rx.rir} en reserva.</p>}
                {last && <p className="pl-hint">Última vez ({formatShort(last.session.date)}): {describeSets(last.ex)}</p>}
              </>
            )}
          </div>

          <footer className="pl-foot">
            {!exDone(e) && <button className="btn primary block lg pl-go" onClick={done}>Serie hecha</button>}
            <div className="pl-links">
              {t && <a href={videoUrl(t.video)} target="_blank" rel="noopener noreferrer"><IconPlay size={16} /> Video</a>}
              <button onClick={() => setHow(true)}>Técnica</button>
              {!exDone(e) && <button onClick={() => onChangeEx(idx, (x) => { x.skipped = { reason: 'Omitido en modo entrenamiento' }; })}>Omitir</button>}
            </div>
          </footer>
        </>
      )}

      <RestOverlay />

      <Sheet open={how} onClose={() => setHow(false)} title={e.name}>
        {t ? <>
          <ExerciseAnim ex={{ id: e.exerciseId, name: e.name }} size={260} />
          <p><b>Músculo:</b> {t.muscle}</p>
          <p><b>Cómo:</b> {t.how}</p>
          <p><b>Errores comunes:</b> {t.errors}</p>
          {t.caution && <p className="warn-text small">{t.caution}</p>}
          <p className="small muted"><b>Alternativa:</b> {t.alternative}</p>
        </> : <p className="muted">Ejercicio sin plantilla.</p>}
      </Sheet>
    </div>,
    document.body,
  );
}

/** Descanso a pantalla completa dentro del modo entrenamiento. Usa el mismo temporizador guardado. */
function RestOverlay() {
  const r = useLive(() => kvGet<RestState>('restTimer'), []);
  const now = useNow(250);
  if (!r) return null;
  const left = Math.ceil((r.endAt - now) / 1000);
  if (left <= 0) return null;
  const mm = Math.floor(left / 60), ss = left % 60;
  const C = 2 * Math.PI * 120;
  return (
    <div className="pl-rest" role="timer" aria-label="Descanso">
      <p className="eyebrow">Descanso</p>
      <div className="pl-ring">
        <svg viewBox="0 0 260 260" aria-hidden="true">
          <circle className="bg" cx="130" cy="130" r="120" />
          <circle className="fg" cx="130" cy="130" r="120" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, left / (r.total || 1))))} />
        </svg>
        <span className="pl-time">{mm}:{String(ss).padStart(2, '0')}</span>
      </div>
      {r.next && <p className="pl-next">{r.next}</p>}
      <div className="row gap">
        <button className="btn secondary" onClick={() => kvSet('restTimer', { ...r, endAt: r.endAt + 30000, total: r.total + 30 }, true)}>+30 s</button>
        <button className="btn ghost" onClick={() => kvSet('restTimer', null, true)}><IconClose size={18} /> Saltar</button>
      </div>
    </div>
  );
}
