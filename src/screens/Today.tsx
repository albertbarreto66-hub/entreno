import { useEffect, useState, type ReactNode } from 'react';
import { useNav } from '../App';
import { SleepSheet, sourceChip, StepsSheet, WaterSheet, WeightSheet } from '../components/QuickSheets';
import { IconBed, IconComidas, IconDrop, IconEntrenar, IconFlame, IconHeart, IconLeaf, IconScale, IconSteps, IconSun, IconBowl, IconCup, IconMoon } from '../components/icons';
import { Check, Chip, CountUp, Field, IconBadge, Segmented, Sheet, useConfirm } from '../components/ui';
import { programWeek } from '../lib/training';
import { STEP_GOAL_MAX } from '../data/profile';
import { patchSettings, getProfile, getSchedule } from '../lib/app';
import { formatLong, timeHM, weekday } from '../lib/dates';
import { del, kvGet, patchDay, put } from '../lib/db';
import { n0, n1, parseIntLoose } from '../lib/format';
import { setGoal } from '../lib/goals';
import { useLive } from '../lib/hooks';
import { logPlanMeal, planMealFor } from '../lib/meals';
import { sumItems } from '../lib/nutrition';
import { loadDaySummary } from '../lib/summary';
import { MAIN_SLOTS, SLOT_LABEL, type MealSlot } from '../lib/types';
import { KIND_LABEL } from '../health/classify';

const SLOT_ICON: Record<string, ReactNode> = { desayuno: <IconSun />, almuerzo: <IconBowl />, merienda: <IconCup />, cena: <IconMoon /> };

function greeting(isToday: boolean) {
  if (!isToday) return 'Registro del día';
  const h = new Date().getHours();
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

type SheetName = null | 'agua' | 'pasos' | 'peso' | 'sueno' | `comida-${MealSlot}`;

export function Today() {
  const { date, today, go } = useNav();
  const s = useLive(() => loadDaySummary(date), [date]);
  const schedule = useLive(getSchedule, []);
  const programStart = useLive(() => kvGet<string>('programStart'), []);
  const profile = useLive(getProfile, []);
  const [sheet, setSheet] = useState<SheetName>(null);
  const confirm = useConfirm();
  const [notes, setNotes] = useState('');
  useEffect(() => { setNotes(s?.day.notes ?? ''); }, [s?.day.notes, date]);
  if (!s) return null;

  const isToday = date === today;
  const wd = weekday(date);
  const mealDone = (slot: MealSlot) => s.meals.some((m) => m.slot === slot);
  const activeSession = s.sessions.find((x) => x.status === 'en-curso');

  const onMealCheck = async (slot: MealSlot) => {
    const logs = s.meals.filter((m) => m.slot === slot);
    if (!logs.length) { setSheet(`comida-${slot}`); return; }
    const r = await confirm({
      title: `Desmarcar ${SLOT_LABEL[slot].toLowerCase()}`,
      body: <>Para desmarcarlo hay que borrar {logs.length > 1 ? `${logs.length} registros` : 'el registro'}: <b>{logs.map((l) => l.title || 'Comida').join(', ')}</b>. ¿Querés borrarlo?</>,
      ok: 'Borrar registro', danger: true, cancel: 'Mantener', extra: [{ label: 'Ver o editar', value: 'edit' }],
    });
    if (r === 'edit') go('comidas');
    else if (r === 'ok') for (const l of logs) await del('meals', l.id);
  };

  const onTrainingCheck = async () => {
    if (!s.trainingDue && !s.trainingDone) return;
    if (s.day.manualTrainingDone) {
      if (await confirm({ title: 'Desmarcar entrenamiento?', body: 'Lo habías marcado como hecho sin registrar series.', ok: 'Desmarcar' })) await patchDay(date, { manualTrainingDone: false });
      return;
    }
    const done = s.sessions.find((x) => x.status === 'completada');
    if (done) {
      const r = await confirm({ title: 'Sesión completada', body: 'Desmarcar no borra las series. ¿Querés cambiar el estado de la sesión a incompleta?', ok: 'Marcar incompleta', extra: [{ label: 'Ver sesión', value: 'ver' }], cancel: 'Dejar como está' });
      if (r === 'ver') go('entrenar');
      else if (r === 'ok') await put('sessions', { ...done, status: 'incompleta', updatedAt: Date.now() });
      return;
    }
    go('entrenar');
  };

  const nextItem = isToday && schedule ? schedule.find((i) => i.time > timeHM(Date.now())) : null;

  return (
    <div className="stack-lg">
      {!s.settings.onboarded && <Welcome />}

      {/* Rutina del día */}
      <section className="card hero">
        <div className="row between">
          <p className="eyebrow">{greeting(isToday)}{profile?.name ? `, ${profile.name}` : ''}</p>
          {programStart && <Chip tone="green">Semana {programWeek(programStart, date)}</Chip>}
        </div>
        <h1 className="h1">
          {s.day.recovery ? 'Día de recuperación' : s.template ? s.template.name : wd === 0 || wd === 6 ? 'Fin de semana' : 'Sin rutina'}
        </h1>
        <p className="muted small">
          {s.day.recovery ? 'Descansar también es parte del plan.' : s.template ? `${formatLong(date).split(' ')[0]} · gimnasio 08:00–09:10 · ${s.template.exercises.length} ejercicios` : 'Sin gimnasio programado. Caminata y comidas como siempre.'}
        </p>
        {s.template && !s.day.recovery && (
          s.trainingDone
            ? <p className="ok-line">✓ Entrenamiento registrado. ¡Bien ahí!</p>
            : <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={() => go('entrenar')}><IconEntrenar />{activeSession ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}</button>
        )}
        <div className="hero-stats">
          <div className="hero-stat"><div className="stat-label"><IconSteps />Pasos</div><div className="stat-value">{s.steps.value != null ? <CountUp value={s.steps.value} /> : '—'}</div></div>
          <div className="hero-stat"><div className="stat-label"><IconDrop />Líquidos</div><div className="stat-value">{s.fluidTotal ? <><CountUp value={s.fluidTotal / 1000} format={(v) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 })} /><small>L</small></> : '—'}</div></div>
          <div className="hero-stat"><div className="stat-label"><IconFlame />Comidas</div><div className="stat-value"><CountUp value={MAIN_SLOTS.filter(mealDone).length} /><small>de 4</small></div></div>
        </div>
        {s.watchWorkouts.length > 0 && (
          <p className="small muted" style={{ marginTop: 10 }}>Actividad del reloj: {s.watchWorkouts.map((w) => `${w.label ?? 'Entrenamiento'} ${Math.round(w.value / 60)} min (${w.sourceName})`).join(', ')}. No reemplaza el registro de tus series.</p>
        )}
        {nextItem && <p className="small" style={{ marginTop: 10 }}>Próximo: <b>{nextItem.time}</b> · {nextItem.label}</p>}
      </section>

      {/* Accesos rápidos */}
      <section className="quick" aria-label="Accesos rápidos">
        <button className="qbtn" onClick={() => go('entrenar')}><IconBadge tone="train"><IconEntrenar /></IconBadge>Entrenar</button>
        <button className="qbtn" onClick={() => go('comidas', 'registrar')}><IconBadge tone="meal"><IconComidas /></IconBadge>Comida</button>
        <button className="qbtn" onClick={() => setSheet('agua')}><IconBadge tone="water"><IconDrop /></IconBadge>Agua</button>
        <button className="qbtn" onClick={() => setSheet('pasos')}><IconBadge tone="steps"><IconSteps /></IconBadge>Pasos</button>
        <button className="qbtn" onClick={() => setSheet('peso')}><IconBadge tone="weight"><IconScale /></IconBadge>Peso</button>
      </section>

      {/* Checks */}
      <section className="card">
        <h2 className="h2">Checks del día</h2>
        <div className="checks">
          {MAIN_SLOTS.map((slot) => {
            const logs = s.meals.filter((m) => m.slot === slot);
            return <Check key={slot} tone="meal" icon={SLOT_ICON[slot]} label={`${SLOT_LABEL[slot]} registrad${slot === 'desayuno' || slot === 'almuerzo' ? 'o' : 'a'}`} done={mealDone(slot)}
              sub={logs.length ? logs.map((l) => l.title || 'Comida').join(', ') : undefined} onClick={() => onMealCheck(slot)} />;
          })}
          <Check tone="train" icon={<IconEntrenar />} label="Entrenamiento completado" done={s.trainingDone} na={!s.trainingDue && !s.trainingDone}
            sub={s.day.recovery ? 'Día de recuperación' : !s.template ? 'No hay gimnasio programado' : s.day.manualTrainingDone ? 'Marcado sin detalle de series' : activeSession ? 'Sesión en curso' : s.sessions.find((x) => x.status === 'incompleta') ? 'Sesión incompleta guardada' : s.sessions.find((x) => x.status === 'omitida') ? 'Sesión omitida' : undefined}
            onClick={s.trainingDue || s.trainingDone ? onTrainingCheck : undefined} />
          <Check tone="steps" icon={<IconSteps />} label="Meta de pasos alcanzada" done={s.stepsMet} onClick={() => setSheet('pasos')}
            sub={<>{s.steps.value != null ? `${n0(s.steps.value)} / ${n0(s.stepGoal ?? 0)}` : 'Sin datos disponibles'} {s.steps.value != null && sourceChip(s.steps.origin)}{s.steps.value != null && !s.steps.countsForGoal && ' · no cuenta para la meta del reloj'}</>} />
          <Check tone="water" icon={<IconDrop />} label="Líquidos registrados" done={s.fluids.length > 0} onClick={() => setSheet('agua')}
            sub={s.fluids.length ? `${n0(s.fluidTotal)} ml` : undefined} />
          <Check tone="sleep" icon={<IconBed />} label="Sueño registrado" done={s.sleep.hours != null} onClick={() => setSheet('sueno')}
            sub={s.sleep.hours != null ? <>{n1(s.sleep.hours)} h {sourceChip(s.sleep.origin === 'manual' ? 'manual' : s.sleep.imported?.kind ?? 'importado')}</> : undefined} />
        </div>
      </section>

      {/* Datos del reloj */}
      {(s.restingHr || s.hrDaily.length > 0) && (
        <section className="card">
          <h2 className="h2"><IconBadge tone="weight" size="sm"><IconHeart /></IconBadge>Frecuencia cardíaca</h2>
          {s.restingHr && <p>En reposo: <b>{Math.round(s.restingHr.value)} lpm</b> {sourceChip(s.restingHr.kind)}</p>}
          {s.hrDaily.map((h) => <p key={h.uuid} className="small">{KIND_LABEL[h.kind]} ({h.sourceName}): mín {Math.round(h.value2 ?? 0)} · prom {Math.round(h.value)} · máx {Math.round(h.value3 ?? 0)} lpm</p>)}
        </section>
      )}

      {/* Cómo estás */}
      <section className="card stack">
        <h2 className="h2"><IconBadge tone="brand" size="sm"><IconLeaf /></IconBadge>Cómo te sentís</h2>
        <Field label="Dolor o molestias hoy">
          <Segmented label="Dolor o molestias" value={s.day.pain ?? 0} onChange={(v) => patchDay(date, { pain: v as 0 | 1 | 2 | 3 })}
            options={[{ value: 0, label: 'Nada' }, { value: 1, label: 'Leve' }, { value: 2, label: 'Moderado' }, { value: 3, label: 'Fuerte' }]} />
        </Field>
        <Field label="Recuperación">
          <Segmented label="Recuperación" value={s.day.recoveryFeel ?? 'normal'} onChange={(v) => patchDay(date, { recoveryFeel: v })}
            options={[{ value: 'buena', label: 'Buena' }, { value: 'normal', label: 'Normal' }, { value: 'mala', label: 'Mala' }]} />
        </Field>
        <label className="switch">
          <input type="checkbox" checked={!!s.day.recovery} onChange={(e) => patchDay(date, { recovery: e.target.checked })} />
          <span>Día de recuperación (descanso, enfermedad o dolor)</span>
        </label>
        {s.day.recovery && <p className="note small">Perfecto. Hoy el entrenamiento no corresponde y eso no cuenta en contra de nada.</p>}
        {(s.day.pain ?? 0) >= 2 && <p className="note small">Con dolor moderado o fuerte, no fuerces. Si persiste o te preocupa, consultá a un profesional.</p>}
        <Field label="Notas del día">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (s.day.notes ?? '') && patchDay(date, { notes })} placeholder="Cómo dormiste, energía, hinchazón, lo que quieras anotar" />
        </Field>
      </section>

      {schedule && (
        <details className="card">
          <summary className="h2">Horario propuesto</summary>
          <p className="small muted">Son horarios orientativos (editables en Ajustes), no un registro de lo que hiciste.</p>
          <ul className="timeline">
            {schedule.map((i) => <li key={i.id} className={nextItem?.id === i.id ? 'next' : isToday && nextItem && i.time < nextItem.time ? 'past' : ''}><b>{i.time}</b> {i.label}</li>)}
          </ul>
        </details>
      )}

      <WaterSheet open={sheet === 'agua'} onClose={() => setSheet(null)} s={s} />
      <StepsSheet open={sheet === 'pasos'} onClose={() => setSheet(null)} s={s} />
      <WeightSheet open={sheet === 'peso'} onClose={() => setSheet(null)} date={date} />
      <SleepSheet open={sheet === 'sueno'} onClose={() => setSheet(null)} s={s} />
      {MAIN_SLOTS.map((slot) => {
        const plan = planMealFor(date, slot as Exclude<MealSlot, 'extra'>, s.settings.preferNoEgg);
        const t = sumItems(plan.variant.items);
        return (
          <Sheet key={slot} open={sheet === `comida-${slot}`} onClose={() => setSheet(null)} title={SLOT_LABEL[slot]}>
            <p className="eyebrow">Plan de hoy</p>
            <p><b>{plan.variant.title}</b></p>
            <p className="small muted">≈ {n0(t.kcal)} kcal · {n0(t.protein)} g proteína (estimado con el catálogo)</p>
            <button className="btn primary block" onClick={async () => { await logPlanMeal(date, slot as Exclude<MealSlot, 'extra'>, s.settings.preferNoEgg); setSheet(null); }}>Comí esto</button>
            <button className="btn secondary block" onClick={() => { setSheet(null); go('comidas', `editar-${slot}`); }}>Modificar</button>
            <button className="btn ghost block" onClick={() => { setSheet(null); go('comidas', `opciones-${slot}`); }}>Elegir otra opción del menú</button>
            <button className="btn ghost block" onClick={() => { setSheet(null); go('comidas', `otra-${slot}`); }}>Registrar otra comida</button>
          </Sheet>
        );
      })}
    </div>
  );
}

function Welcome() {
  const [v, setV] = useState(15000);
  const [custom, setCustom] = useState('');
  const { today, go } = useNav();
  const profile = useLive(getProfile, []);
  const finish = async () => {
    const goal = custom ? parseIntLoose(custom) : v;
    if (goal && goal >= 1000 && goal <= STEP_GOAL_MAX) await setGoal('steps', goal, today);
    await patchSettings({ onboarded: true });
  };
  return (
    <section className="card welcome stack">
      <h2 className="h2">Hola{profile?.name ? `, ${profile.name}` : ''} 👋</h2>
      <p>Esta app guarda todo en este dispositivo. Nada se envía a internet.</p>
      <p><b>Meta de pasos para la semana 1.</b> Pediste 15.000 si ya los tolerás; si no, empezá más abajo. No sube sola: cada semana podés revisarla.</p>
      <Segmented label="Meta de pasos inicial" value={custom ? 0 : v} onChange={(x) => { setV(x); setCustom(''); }}
        options={[8000, 10000, 12000, 15000].map((x) => ({ value: x, label: n0(x) }))} />
      <Field label="Otra meta"><input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ej.: 11000" /></Field>
      <button className="btn primary block" onClick={finish}>Empezar</button>
      {!profile?.name && <button className="btn ghost block" onClick={() => go('ajustes')}>Tengo un archivo de perfil o respaldo: restaurarlo</button>}
    </section>
  );
}
