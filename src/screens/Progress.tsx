import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../App';
import { Chart } from '../components/Chart';
import { Chip, Empty, Field, Segmented, Sheet, useConfirm, useToast } from '../components/ui';
import { WeightSheet } from '../components/QuickSheets';
import { STEP_GOAL_MAX } from '../data/profile';
import { getProfile } from '../lib/app';
import { addDays, formatLong, formatShort, weekStart } from '../lib/dates';
import { all, del, put } from '../lib/db';
import { saveFile } from '../lib/files';
import { n0, n1, parseIntLoose, parseNum, uid } from '../lib/format';
import { goalFor, setGoal } from '../lib/goals';
import { useLive } from '../lib/hooks';
import { compressImage, isQuotaError } from '../lib/image';
import { reviewStepWeek } from '../lib/steps';
import { loadRange } from '../lib/summary';
import { doneSets, normName } from '../lib/training';
import { trend, weeklyAverages } from '../lib/trends';
import type { PhotoPose, PhotoRec } from '../lib/types';
import { KIND_LABEL } from '../health/classify';

const C = { main: '#1f7a44', avg: '#0b4f8a', soft: '#8cc9a4', amber: '#b4690e' };

export function Progress() {
  const [tab, setTab] = useState<'graficos' | 'fotos'>('graficos');
  return (
    <div className="stack-lg">
      <Segmented label="Sección" value={tab} onChange={setTab} options={[{ value: 'graficos', label: 'Gráficos' }, { value: 'fotos', label: 'Fotos' }]} />
      {tab === 'graficos' ? <Charts /> : <Photos />}
    </div>
  );
}

function Charts() {
  const { today } = useNav();
  const [weeks, setWeeks] = useState(8);
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const data = useLive(async () => {
    const [body, sessions, range, goals, profile] = await Promise.all([all('body'), all('sessions'), loadRange(from, today), all('goals'), getProfile()]);
    return { body: body.filter((b) => b.date >= from), sessions: sessions.filter((s) => s.date >= from), range, goals, profile };
  }, [from, today]);
  const [ex, setEx] = useState('');
  const [weightOpen, setWeightOpen] = useState(false);
  const confirm = useConfirm();
  if (!data) return null;
  const { body, sessions, range, goals, profile } = data;

  const weight = body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, value: b.weightKg! }));
  const waist = body.filter((b) => b.waistCm != null).map((b) => ({ date: b.date, value: b.waistCm! }));
  const wAvg = weeklyAverages(weight).map((w) => ({ date: addDays(w.week, 3), value: w.avg }));
  const steps = range.filter((d) => d.steps.value != null).map((d) => ({ date: d.date, value: d.steps.value! }));
  const sAvg = weeklyAverages(steps).map((w) => ({ date: addDays(w.week, 3), value: w.avg }));
  const sleep = range.filter((d) => d.sleep.hours != null).map((d) => ({ date: d.date, value: d.sleep.hours! }));
  const rhr = range.filter((d) => d.restingHr).map((d) => ({ date: d.date, value: d.restingHr!.value }));
  const completed = sessions.filter((s) => s.status === 'completada');
  const perWeek = new Map<string, number>();
  for (const s of completed) perWeek.set(weekStart(s.date), (perWeek.get(weekStart(s.date)) ?? 0) + 1);
  const exNames = [...new Set(sessions.flatMap((s) => s.exercises.filter((e) => doneSets(e).length).map((e) => e.name)))].sort();
  const exSel = ex || exNames[0] || '';
  const exPts = sessions.filter((s) => s.status !== 'omitida').flatMap((s) => s.exercises.filter((e) => normName(e.name) === normName(exSel) && !e.skipped).map((e) => ({ s, e })))
    .filter(({ e }) => doneSets(e).length);
  const topKg = exPts.filter(({ e }) => doneSets(e).some((x) => x.kg != null)).map(({ s, e }) => ({ date: s.date, value: Math.max(...doneSets(e).map((x) => x.kg ?? 0)) }));
  const totReps = exPts.map(({ s, e }) => ({ date: s.date, value: doneSets(e).reduce((a, x) => a + (x.reps ?? 0), 0) }));
  const thisWeek = range.filter((d) => d.date >= weekStart(today));
  const daysLogged = thisWeek.filter((d) => d.meals.length || d.fluids.length || d.sessions.length || d.steps.value != null || d.sleep.hours != null).length;
  const currentGoal = goalFor(goals, 'steps', today) ?? 15000;
  const watchWorkouts = range.flatMap((d) => d.watchWorkouts);

  return (
    <>
      <section className="card">
        <h2 className="h2">Constancia esta semana</h2>
        <p>Días con algún registro: <b>{daysLogged}</b> · Entrenamientos completados: <b>{completed.filter((s) => s.date >= weekStart(today)).length}</b></p>
        <p className="small muted">Descansar, estar enfermo o con dolor también es parte del proceso: no resta.</p>
      </section>

      <Segmented label="Período" value={weeks} onChange={setWeeks} options={[{ value: 4, label: '4 sem' }, { value: 8, label: '8 sem' }, { value: 12, label: '12 sem' }, { value: 26, label: '6 meses' }]} />

      <section className="card stack">
        <div className="row between"><h2 className="h2">Peso</h2><button className="btn secondary small" onClick={() => setWeightOpen(true)}>+ Registrar</button></div>
        {weight.length ? <Chart ariaLabel="Peso registrado y promedio semanal" unit="kg" series={[{ label: 'Registrado', points: weight, style: 'dots', color: C.soft }, { label: 'Promedio semanal', points: wAvg, style: 'line', color: C.avg }]} />
          : <Empty>Todavía no registraste peso en este período.</Empty>}
        <p className="small">{trend(weight, 'kg').message}</p>
        {profile.initialWeightKg != null && <p className="small muted">Dato inicial informado: {n1(profile.initialWeightKg)} kg (no es una medición registrada; no se grafica).</p>}
      </section>

      <section className="card stack">
        <h2 className="h2">Cintura</h2>
        {waist.length ? <Chart ariaLabel="Cintura" unit="cm" series={[{ label: 'Cintura', points: waist, style: 'dots', color: C.main }]} /> : <Empty>Sin mediciones de cintura en este período.</Empty>}
        {waist.length > 0 && <p className="small">{trend(waist, 'cm').message}</p>}
      </section>

      {body.length > 0 && (
        <details className="card">
          <summary className="h2">Mediciones registradas ({body.length})</summary>
          <ul className="list">
            {[...body].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).map((b) => (
              <li key={b.id} className="row between">
                <span>{formatShort(b.date)} · {b.weightKg != null ? `${n1(b.weightKg)} kg` : ''} {b.waistCm != null ? `${n1(b.waistCm)} cm` : ''} <span className="muted small">{b.note}</span></span>
                <button className="btn ghost small" onClick={async () => { if (await confirm({ title: 'Borrar medición?', ok: 'Borrar', danger: true })) del('body', b.id); }}>Borrar</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="card stack">
        <h2 className="h2">Pasos</h2>
        {steps.length ? <Chart ariaLabel="Pasos por día y promedio semanal" unit="pasos" decimals={0} goal={currentGoal} series={[{ label: 'Por día', points: steps, style: 'bars', color: C.soft }, { label: 'Promedio semanal', points: sAvg, style: 'line', color: C.avg }]} />
          : <Empty>Sin pasos registrados en este período.</Empty>}
        <StepReview today={today} currentGoal={currentGoal} />
      </section>

      <section className="card stack">
        <h2 className="h2">Entrenamientos completados por semana</h2>
        {perWeek.size ? <Chart ariaLabel="Entrenamientos por semana" unit="sesiones" decimals={0} series={[{ label: 'Completados', points: [...perWeek].map(([w, n]) => ({ date: w, value: n })), style: 'bars', color: C.main }]} /> : <Empty>Todavía no hay sesiones completadas.</Empty>}
        {sessions.length > 0 && (
          <ul className="list small">
            {[...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((s) => (
              <li key={s.id}>{formatShort(s.date)} · {s.templateName} <Chip tone={s.status === 'completada' ? 'green' : s.status === 'omitida' ? 'gray' : 'amber'}>{s.status}</Chip>{s.omitReason ? ` ${s.omitReason}` : ''}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack">
        <h2 className="h2">Cargas y repeticiones por ejercicio</h2>
        {exNames.length ? (
          <>
            <Field label="Ejercicio"><select value={exSel} onChange={(e) => setEx(e.target.value)}>{exNames.map((n) => <option key={n}>{n}</option>)}</select></Field>
            {topKg.length > 0 && <Chart ariaLabel={`Carga máxima en ${exSel}`} unit="kg (serie más pesada)" series={[{ label: 'Carga', points: topKg, style: 'dots', color: C.main }]} />}
            <Chart ariaLabel={`Repeticiones totales en ${exSel}`} unit="reps efectivas totales" decimals={0} series={[{ label: 'Reps', points: totReps, style: 'bars', color: C.soft }]} />
          </>
        ) : <Empty>Cuando registres series, vas a ver acá la evolución.</Empty>}
      </section>

      <section className="card stack">
        <h2 className="h2">Sueño</h2>
        {sleep.length ? <Chart ariaLabel="Horas de sueño" unit="horas" series={[{ label: 'Horas', points: sleep, style: 'bars', color: C.avg }]} /> : <Empty>Sin registros de sueño en este período.</Empty>}
      </section>

      {rhr.length > 0 && (
        <section className="card stack">
          <h2 className="h2">Frecuencia cardíaca en reposo</h2>
          <Chart ariaLabel="Frecuencia cardíaca en reposo" unit="lpm" decimals={0} series={[{ label: 'En reposo', points: rhr, style: 'dots', color: C.amber }]} />
        </section>
      )}

      {watchWorkouts.length > 0 && (
        <section className="card">
          <h2 className="h2">Actividades importadas del reloj</h2>
          <ul className="list small">
            {watchWorkouts.slice(-15).reverse().map((w) => <li key={w.uuid}>{formatShort(w.date)} · {w.label ?? 'Entrenamiento'} · {Math.round(w.value / 60)} min{w.value2 ? ` · ${n0(w.value2)} kcal` : ''}{w.value3 ? ` · FC media ${Math.round(w.value3)}` : ''} · {KIND_LABEL[w.kind]} ({w.sourceName})</li>)}
          </ul>
          <p className="small muted">Solo informa duración, energía y FC si la fuente los guardó. No confirma ejercicios, cargas ni repeticiones.</p>
        </section>
      )}
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} date={today} />
    </>
  );
}

function StepReview({ today, currentGoal }: { today: string; currentGoal: number }) {
  const lastWeekStart = addDays(weekStart(today), -7);
  const days = useLive(() => loadRange(lastWeekStart, addDays(lastWeekStart, 6)), [lastWeekStart]);
  const [custom, setCustom] = useState('');
  const toast = useToast();
  if (!days) return null;
  const r = reviewStepWeek({
    currentGoal,
    days: days.map((d) => ({ date: d.date, steps: d.steps.value, goal: d.stepGoal, met: d.stepsMet, pain: d.day.pain, recoveryFeel: d.day.recoveryFeel, sleepHours: d.sleep.hours })),
  });
  const apply = async (v: number) => {
    if (v < 1000 || v > STEP_GOAL_MAX) { toast(`La meta debe estar entre 1.000 y ${n0(STEP_GOAL_MAX)}.`, 'error'); return; }
    await setGoal('steps', v, today);
    toast(`Meta de pasos desde hoy: ${n0(v)}`);
  };
  return (
    <div className="review">
      <h3 className="h3">Revisión semanal de la meta</h3>
      <p className="small">Meta actual: <b>{n0(currentGoal)}</b>. Semana pasada ({formatShort(lastWeekStart)}–{formatShort(addDays(lastWeekStart, 6))}): {r.daysMet} días cumplidos, {r.daysWithData} con datos.</p>
      <ul className="small list plain">{r.reasons.map((x, i) => <li key={i}>• {x}</li>)}</ul>
      <div className="row gap wrap">
        <button className="btn secondary small" onClick={() => toast('Meta sin cambios')}>Mantener</button>
        {r.canIncrease && <button className="btn primary small" onClick={() => apply(r.suggested!)}>Subir a {n0(r.suggested!)}</button>}
        <button className="btn ghost small" onClick={() => apply(currentGoal - 500)}>Bajar a {n0(currentGoal - 500)}</button>
      </div>
      <div className="row gap">
        <input aria-label="Nueva meta de pasos" inputMode="numeric" placeholder="Otra meta" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="btn ghost small" disabled={!custom} onClick={() => { const v = parseIntLoose(custom); if (v) apply(v); setCustom(''); }}>Aplicar</button>
      </div>
      <p className="tiny muted">El cambio rige desde hoy. Los días anteriores conservan la meta que tenían.</p>
    </div>
  );
}

// ---------------- Fotos ----------------
const POSES: PhotoPose[] = ['frente', 'perfil', 'espalda'];

function usePhotoUrl(p: PhotoRec | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (!p) { setUrl(undefined); return; } const u = URL.createObjectURL(p.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [p]);
  return url;
}

function Photos() {
  const { date } = useNav();
  const photos = useLive(async () => (await all('photos')).filter((p) => p.kind === 'progreso').sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at), []);
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<PhotoRec | null>(null);
  if (!photos) return null;
  const byWeek = new Map<string, PhotoRec[]>();
  for (const p of photos) { const w = weekStart(p.date); if (!byWeek.has(w)) byWeek.set(w, []); byWeek.get(w)!.push(p); }
  return (
    <>
      <section className="card stack">
        <h2 className="h2">Fotos semanales</h2>
        <p className="small muted">Para comparar mejor: misma luz, misma distancia, misma postura y mismo horario (por ejemplo, el lunes al levantarte). Las fotos quedan solo en este dispositivo. La app no estima grasa corporal ni saca conclusiones de las imágenes.</p>
        <button className="btn primary block" onClick={() => setAddOpen(true)}>+ Agregar foto</button>
      </section>
      {photos.length >= 2 ? <Compare photos={photos} /> : <Empty>Con dos fotos de la misma pose vas a poder compararlas lado a lado o con deslizador.</Empty>}
      {[...byWeek].map(([w, ps]) => (
        <section className="card" key={w}>
          <h3 className="h3">Semana del {formatShort(w)}</h3>
          <div className="thumbs">{ps.map((p) => <Thumb key={p.id} p={p} onClick={() => setView(p)} />)}</div>
        </section>
      ))}
      <AddPhoto open={addOpen} onClose={() => setAddOpen(false)} date={date} />
      {view && <PhotoView p={view} onClose={() => setView(null)} />}
    </>
  );
}

function Thumb({ p, onClick }: { p: PhotoRec; onClick: () => void }) {
  const url = usePhotoUrl(p);
  return (
    <button className="thumb" onClick={onClick} aria-label={`Foto ${p.pose} del ${formatShort(p.date)}`}>
      {url && <img src={url} alt="" />}
      <span>{p.pose} · {formatShort(p.date)}</span>
    </button>
  );
}

function AddPhoto({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [pose, setPose] = useState<PhotoPose>('frente');
  const [d, setD] = useState(date);
  const [w, setW] = useState(''); const [c, setC] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (open) { setD(date); setW(''); setC(''); setNote(''); } }, [open, date]);
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const img = await compressImage(file);
      await put('photos', { id: uid(), kind: 'progreso', date: d, pose, blob: img.blob, type: img.type, width: img.width, height: img.height, weightKg: w ? parseNum(w) : null, waistCm: c ? parseNum(c) : null, note, at: Date.now() });
      onClose();
    } catch (e) {
      toast(isQuotaError(e) ? 'No hay espacio para guardar la foto. Exportá un respaldo y borrá fotos viejas.' : (e as Error).message || 'No se pudo guardar la foto.', 'error');
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Agregar foto">
      <Segmented label="Pose" value={pose} onChange={setPose} options={POSES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} />
      <Field label="Fecha"><input type="date" value={d} max={date} onChange={(e) => setD(e.target.value)} /></Field>
      <div className="row gap">
        <Field label="Peso (opcional)"><input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="kg" /></Field>
        <Field label="Cintura (opcional)"><input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder="cm" /></Field>
      </div>
      <Field label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="row gap">
        <label className={`btn primary grow ${busy ? 'disabled' : ''}`}>📷 Cámara<input hidden type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} /></label>
        <label className={`btn secondary grow ${busy ? 'disabled' : ''}`}>🖼 Galería<input hidden type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} data-testid="photo-gallery" /></label>
      </div>
      {busy && <p className="small muted">Procesando…</p>}
      <p className="tiny muted">Se guarda una copia comprimida (lado mayor 1600 px) sin deformar la imagen.</p>
    </Sheet>
  );
}

function PhotoView({ p, onClose }: { p: PhotoRec; onClose: () => void }) {
  const url = usePhotoUrl(p);
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <Sheet open onClose={onClose} title={`${p.pose} · ${formatLong(p.date)}`}>
      {url && <img className="full" src={url} alt={`Foto ${p.pose}`} />}
      <p className="small">{p.weightKg != null ? `${n1(p.weightKg)} kg · ` : ''}{p.waistCm != null ? `${n1(p.waistCm)} cm · ` : ''}{p.note}</p>
      <div className="row gap">
        <button className="btn secondary grow" onClick={async () => { try { toast(await saveFile(p.blob, `foto-${p.pose}-${p.date}.jpg`)); } catch (e) { toast((e as Error).message, 'error'); } }}>Exportar</button>
        <button className="btn danger grow" onClick={async () => { if (await confirm({ title: 'Borrar esta foto?', body: 'No se puede deshacer (salvo que tengas un respaldo).', ok: 'Borrar', danger: true })) { await del('photos', p.id); onClose(); } }}>Borrar</button>
      </div>
    </Sheet>
  );
}

function Compare({ photos }: { photos: PhotoRec[] }) {
  const poses = POSES.filter((po) => photos.filter((p) => p.pose === po).length >= 2);
  const [pose, setPose] = useState<PhotoPose>(poses[0] ?? 'frente');
  const list = photos.filter((p) => p.pose === pose);
  const [aId, setAId] = useState(''); const [bId, setBId] = useState('');
  const [mode, setMode] = useState<'lado' | 'deslizador'>('lado');
  const [pos, setPos] = useState(50);
  const a = useMemo(() => list.find((p) => p.id === aId) ?? list[list.length - 1], [list, aId]);
  const b = useMemo(() => list.find((p) => p.id === bId) ?? list[0], [list, bId]);
  const ua = usePhotoUrl(a), ub = usePhotoUrl(b);
  if (!poses.length) return <Empty>Para comparar necesitás dos fotos de la misma pose.</Empty>;
  return (
    <section className="card stack">
      <h2 className="h2">Comparar</h2>
      <Segmented label="Pose" value={pose} onChange={(v) => { setPose(v); setAId(''); setBId(''); }} options={poses.map((p) => ({ value: p, label: p }))} />
      <div className="row gap">
        <Field label="Antes"><select value={a?.id} onChange={(e) => setAId(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{formatShort(p.date)}{p.note ? ` · ${p.note}` : ''}</option>)}</select></Field>
        <Field label="Después"><select value={b?.id} onChange={(e) => setBId(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{formatShort(p.date)}{p.note ? ` · ${p.note}` : ''}</option>)}</select></Field>
      </div>
      <Segmented label="Modo" value={mode} onChange={setMode} options={[{ value: 'lado', label: 'Lado a lado' }, { value: 'deslizador', label: 'Deslizador' }]} />
      {mode === 'lado' ? (
        <div className="side">
          <figure><div className="frame">{ua && <img src={ua} alt={`Antes ${a.date}`} />}</div><figcaption>{formatShort(a.date)}</figcaption></figure>
          <figure><div className="frame">{ub && <img src={ub} alt={`Después ${b.date}`} />}</div><figcaption>{formatShort(b.date)}</figcaption></figure>
        </div>
      ) : (
        <>
          <div className="slider-frame" data-testid="slider-frame">
            {ua && <img src={ua} alt={`Antes ${a.date}`} />}
            {ub && <img src={ub} alt={`Después ${b.date}`} style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />}
            <div className="slider-line" style={{ left: `${pos}%` }} aria-hidden="true" />
            <span className="tag l">{formatShort(a.date)}</span><span className="tag r">{formatShort(b.date)}</span>
          </div>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Deslizador de comparación" />
        </>
      )}
      <p className="tiny muted">Las fotos se muestran completas y sin estirar; si tienen proporciones distintas, queda espacio en los bordes.</p>
    </section>
  );
}
