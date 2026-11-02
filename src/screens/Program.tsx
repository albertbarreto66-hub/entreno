import { useState } from 'react';
import { useNav } from '../App';
import { WeightSheet } from '../components/QuickSheets';
import { Chip, CountUp, Empty, Field, Segmented, useConfirm, useToast } from '../components/ui';
import { BLOCKS, blockForWeek, PROGRAM_WEEKS } from '../data/program';
import { getProfile, getSettings } from '../lib/app';
import { avgOf, evaluateWeek, strengthTrend } from '../lib/checkin';
import { addDays, formatShort } from '../lib/dates';
import { all, kvGet, patchDay } from '../lib/db';
import { energyPlan, projection, waistToHeight } from '../lib/energy';
import { n0, n1 } from '../lib/format';
import { goalFor, setGoal } from '../lib/goals';
import { useLive } from '../lib/hooks';
import { applyProgram, menuAverages, nextMonday, programApplied } from '../lib/programApply';
import { loadRange } from '../lib/summary';
import { getTemplates, plannedSetsFor, programWeek } from '../lib/training';
import { weeklyAverages } from '../lib/trends';
import { MAIN_SLOTS } from '../lib/types';

const STATUS_TONE = { 'sin-datos': 'gray', adherencia: 'amber', lento: 'amber', 'en-rango': 'green', rapido: 'blue' } as const;

async function loadControl(today: string) {
  const from = addDays(today, -27);
  const [body, sessions, range, goals, profile, programStart, settings] = await Promise.all([
    all('body'), all('sessions'), loadRange(from, today), all('goals'), getProfile(), kvGet<string>('programStart'), getSettings(),
  ]);
  return { body, sessions, range, goals, profile, programStart, settings };
}

/** Control semanal: medidas, cómo te sentís y qué ajustar. */
export function WeeklyControl() {
  const { today } = useNav();
  const d = useLive(() => loadControl(today), [today]);
  const [measure, setMeasure] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  if (!d) return null;
  const last7 = d.range.filter((x) => x.date > addDays(today, -7));
  const week = programWeek(d.programStart, today);
  const weights = d.body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, value: b.weightKg! }));
  const waists = d.body.filter((b) => b.waistCm != null).map((b) => ({ date: b.date, value: b.waistCm! }));
  const daysWithMeals = last7.filter((x) => MAIN_SLOTS.every((s) => x.meals.some((m) => m.slot === s))).length;
  const anyMeals = d.range.some((x) => x.meals.length > 0);
  const planned = last7.filter((x) => x.trainingDue || x.trainingDone).length;
  const doneT = last7.filter((x) => x.trainingDone).length;
  const sleepAvg = avgOf(last7.map((x) => x.sleep.hours).filter((h): h is number => h != null));
  const stepsAvg = avgOf(last7.map((x) => x.steps.value).filter((v): v is number => v != null));
  const strength = strengthTrend(d.sessions, today);
  const todayLog = d.range.find((x) => x.date === today)?.day;
  const lastCheckin = [...d.range].reverse().find((x) => x.day.checkin)?.day.checkin ?? null;
  const ck = todayLog?.checkin ?? { energy: 3, hunger: 3, recovery: 3 };
  const res = evaluateWeek({
    today, programWeek: week, weights, waists, adherence: anyMeals ? daysWithMeals / 7 : null, trainingsDone: doneT, trainingsPlanned: planned,
    sleepAvg, stepsAvg, strength, checkin: lastCheckin,
  });
  const kcalNow = goalFor(d.goals, 'kcal', today) ?? 2450;
  const setCk = (k: 'energy' | 'hunger' | 'recovery', v: number) => patchDay(today, { checkin: { ...ck, [k]: v } });
  const weeks = weeklyAverages(weights).slice(-8).reverse();

  return (
    <>
      <section className="card hero stack">
        <div className="row between"><p className="eyebrow">Control semanal · semana {Math.min(week, PROGRAM_WEEKS)} de {PROGRAM_WEEKS}</p><Chip tone={STATUS_TONE[res.status]}>{res.status === 'en-rango' ? 'En ritmo' : res.status === 'sin-datos' ? 'Sin datos' : res.status === 'adherencia' ? 'Constancia' : res.status === 'lento' ? 'Estancado' : 'Muy rápido'}</Chip></div>
        <h1 className="h1">{res.title}</h1>
        <div className="hero-stats">
          <div className="hero-stat"><div className="stat-label">Prom. semanal</div><div className="stat-value">{res.weekAvg != null ? <><CountUp value={res.weekAvg} format={(v) => n1(v)} /><small>kg</small></> : '—'}</div></div>
          <div className="hero-stat"><div className="stat-label">Cambio</div><div className="stat-value">{res.rate != null ? `${res.rate >= 0 ? '−' : '+'}${n1(Math.abs(res.rate))}%` : '—'}</div></div>
          <div className="hero-stat"><div className="stat-label">Abdomen</div><div className="stat-value">{res.waistChange != null ? `${res.waistChange <= 0 ? '−' : '+'}${n1(Math.abs(res.waistChange))}` : '—'}<small>cm</small></div></div>
        </div>
        <ul className="list plain small" style={{ marginTop: 10 }}>{res.actions.map((a, i) => <li key={i}>• {a}</li>)}</ul>
        {res.kcalDelta !== 0 && (
          <button className="btn primary block" onClick={async () => {
            if (!(await confirm({ title: `${res.kcalDelta > 0 ? 'Subir' : 'Bajar'} a ${n0(kcalNow + res.kcalDelta)} kcal desde hoy?`, body: 'El cambio rige desde hoy; los días anteriores conservan su meta. Podés deshacerlo en Ajustes → Metas.', ok: 'Aplicar' }))) return;
            await setGoal('kcal', kcalNow + res.kcalDelta, today);
            toast('Meta de calorías actualizada');
          }}>Aplicar {res.kcalDelta > 0 ? '+' : '−'}{Math.abs(res.kcalDelta)} kcal ({n0(kcalNow)} → {n0(kcalNow + res.kcalDelta)})</button>
        )}
      </section>

      <section className="stat-tiles">
        <div className="stat-tile"><div className="stat-value">{daysWithMeals}/7</div><div className="stat-label">días con las 4 comidas</div></div>
        <div className="stat-tile"><div className="stat-value">{doneT}/{planned || 5}</div><div className="stat-label">entrenamientos</div></div>
        <div className="stat-tile"><div className="stat-value">{stepsAvg != null ? n0(stepsAvg) : '—'}</div><div className="stat-label">pasos promedio</div></div>
        <div className="stat-tile"><div className="stat-value">{sleepAvg != null ? `${n1(sleepAvg)} h` : '—'}</div><div className="stat-label">sueño promedio</div></div>
        <div className="stat-tile"><div className="stat-value">↑{strength.up} ↓{strength.down}</div><div className="stat-label">ejercicios con fuerza en subida / bajada</div></div>
        <div className="stat-tile"><div className="stat-value">{n0(kcalNow)}</div><div className="stat-label">kcal objetivo</div></div>
      </section>

      <section className="card stack">
        <h2 className="h2">Cómo te sentiste esta semana</h2>
        {([['energy', 'Energía'], ['hunger', 'Hambre'], ['recovery', 'Recuperación muscular']] as const).map(([k, l]) => (
          <Field key={k} label={`${l} (1 = muy baja · 5 = muy buena${k === 'hunger' ? ' / mucha hambre' : ''})`}>
            <Segmented label={l} value={ck[k]} onChange={(v) => setCk(k, v)} options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))} />
          </Field>
        ))}
        <button className="btn secondary block" onClick={() => setMeasure(true)}>Registrar peso y medidas</button>
        <p className="small muted">Una vez por semana (por ejemplo, el lunes en ayunas): medidas y estas 3 respuestas. El peso, idealmente 3–7 días por semana.</p>
      </section>

      <section className="card">
        <h2 className="h2">Semanas</h2>
        {weeks.length ? (
          <table className="tbl">
            <thead><tr><th>Semana del</th><th>Peso prom.</th><th>Pesajes</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.week}><td>{formatShort(w.week)}</td><td>{n1(w.avg)} kg</td><td>{w.n}</td></tr>)}</tbody>
          </table>
        ) : <Empty>Cuando registres peso, vas a ver acá el promedio de cada semana.</Empty>}
      </section>

      <section className="card small">
        <h2 className="h2">Criterios de ajuste</h2>
        <ul className="list">
          <li><b>Ritmo buscado:</b> bajar 0,5–1 % del peso por semana (≈ 0,5–1 kg), con la fuerza estable o en subida.</li>
          <li><b>Si el promedio semanal casi no baja 2 semanas</b> (menos de 0,25 %) y el abdomen tampoco, con buena constancia: −150 kcal o +1.000 pasos.</li>
          <li><b>Si baja más de 1 % por semana 2 semanas</b> (después de las 2 primeras) o la fuerza cae: +150 kcal.</li>
          <li><b>Si la constancia es baja</b> (menos de 6 de 7 días con las 4 comidas): no se tocan calorías; primero constancia.</li>
          <li><b>Si la recuperación es mala</b> (energía o recuperación ≤ 2, menos de 6 h de sueño, fuerza bajando en 3+ ejercicios): una serie menos esa semana y no bajar calorías.</li>
          <li><b>Pasos:</b> +500 por semana solo si cumpliste 5 de 7 días sin dolor (revisión en Gráficos → Pasos). Tope de la plantilla: 20.000.</li>
        </ul>
      </section>
      <WeightSheet open={measure} onClose={() => setMeasure(false)} date={today} />
    </>
  );
}

const MUSCLES: [string, RegExp][] = [
  ['Pecho', /pecho/i], ['Espalda / dorsal', /dorsal|espalda/i], ['Hombro lateral', /hombro lateral/i], ['Hombro posterior', /posterior/i],
  ['Bíceps', /bíceps/i], ['Tríceps', /tríceps/i], ['Cuádriceps', /cuádriceps/i], ['Isquiotibiales', /isquio/i], ['Glúteo', /glúteo/i], ['Pantorrillas', /pantorr/i], ['Core', /core|abdominal/i],
];

/** El programa completo, con los números calculados para vos. */
export function ProgramView() {
  const { today } = useNav();
  const d = useLive(async () => {
    const [profile, body, programStart, applied, templates, range, goals] = await Promise.all([
      getProfile(), all('body'), kvGet<string>('programStart'), programApplied(), getTemplates(), loadRange(addDays(today, -13), today), all('goals'),
    ]);
    return { profile, body, programStart, applied, templates, range, goals };
  }, [today]);
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState<number | null>(null);
  if (!d) return null;
  const hist = `${d.profile.history} ${d.profile.preferences}`.toLowerCase();
  const has = (re: RegExp) => re.test(hist);
  const week = d.applied ? programWeek(d.programStart, today) : 0;
  const block = blockForWeek(Math.max(1, week));
  const lastW = [...d.body].filter((b) => b.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? d.profile.initialWeightKg ?? null;
  const lastWaist = [...d.body].filter((b) => b.waistCm != null).sort((a, b) => b.date.localeCompare(a.date))[0]?.waistCm ?? null;
  const stepsAvg = avgOf(d.range.map((x) => x.steps.value).filter((v): v is number => v != null)) ?? 9500;
  const ready = lastW != null && d.profile.heightCm != null && d.profile.age != null;
  const plan = ready ? energyPlan({ sex: d.profile.sex ?? 'masculino', weightKg: lastW!, heightCm: d.profile.heightCm!, age: d.profile.age!, stepsAvg, trainingDays: 5 }) : null;
  const menu = menuAverages();
  const stepsStart = Math.min(15000, Math.max(8000, Math.round(stepsAvg / 500) * 500));
  const wk = Math.max(1, week || 5);
  const volume = MUSCLES.map(([name, re]) => [name, d.templates.flatMap((t) => t.exercises).filter((e) => re.test(e.muscle.split(',')[0]) || (name === 'Pecho' && /pecho/i.test(e.muscle)))
    .reduce((a, e) => a + plannedSetsFor(e, wk), 0)] as const);

  const apply = async () => {
    const start = nextMonday(today);
    const ok = await confirm({
      title: 'Aplicar el programa de 24 semanas',
      body: <>Semana 1 empieza el <b>{formatShort(start)}</b>. Se actualizan desde hoy: calorías ({n0(menu.kcal)}), proteína ({menu.protein} g), pasos ({n0(stepsStart)}) y el horario propuesto. No se borra ningún registro.</>,
      ok: 'Aplicar programa',
    });
    if (!ok) return;
    await applyProgram({ today, start, stepsStart });
    toast('Programa aplicado');
  };

  const proj = lastW ? [30, 60, 90, 120, 180].map((days) => ({ days, ...projection(lastW, days) })) : [];

  return (
    <>
      <section className="card hero stack">
        <p className="eyebrow">Programa de transformación · 24 semanas</p>
        <h1 className="h1">{d.applied ? `Semana ${Math.min(Math.max(week, 1), PROGRAM_WEEKS)} · ${block.name}` : 'Déficit moderado + hipertrofia'}</h1>
        <p className="small muted">{d.applied ? block.goal : 'Bajar grasa con un déficit moderado mientras entrenás fuerza 5 días para conservar y ganar músculo. Con tu nivel actual de grasa y la experiencia previa, es la estrategia con mejor relación resultado / sostenibilidad.'}</p>
        {d.applied && week < 1 && <p className="small">Empieza el {formatShort(d.applied.start)}.</p>}
        {!d.applied ? <button className="btn primary block lg" onClick={apply}>Aplicar programa</button>
          : <button className="btn ghost small" onClick={apply}>Reiniciar desde el próximo lunes</button>}
      </section>

      <section className="card stack">
        <h2 className="h2">Meta a largo plazo: físico atlético y marcado</h2>
        <p className="small">Hombros redondos y anchos, pecho superior lleno, brazos grandes, espalda en V y abdomen marcado. Ese aspecto depende de dos cosas: <b>grasa corporal baja (≈ 10–13 %)</b> y <b>músculo en los lugares que dan forma</b> (hombro lateral, pecho superior, brazos, dorsales, abdomen). Por eso la rutina prioriza esos grupos todas las semanas.</p>
        {d.profile.heightCm ? <p className="small">Indicador concreto: cintura ≈ <b>{Math.round(d.profile.heightCm * 0.45)} cm</b> o menos (cintura/altura ≤ 0,45){lastWaist ? `; hoy: ${n1(lastWaist)} cm` : ''}. El peso final se decide por cintura, fotos y fuerza, no por un número fijo.</p> : null}
        <ol className="list small">
          <li><b>Meses 0–6 (este programa):</b> bajar la mayor parte de la grasa, recuperar y sumar fuerza.</li>
          <li><b>Meses 6–12:</b> seguir en déficit moderado con pausas en mantenimiento hasta que el abdomen se empiece a marcar (≈ 15 % de grasa).</li>
          <li><b>Meses 12–18:</b> llegar a ≈ 10–13 % (abdominales visibles) cuidando la fuerza.</li>
          <li><b>Después:</b> etapas de volumen limpio (subir ≈ 0,25–0,5 % del peso por mes) para sumar músculo, alternadas con definiciones cortas.</li>
        </ol>
        <p className="small muted">Partiendo de 28–35 % de grasa, llegar a ese nivel suele llevar entre 1,5 y 3 años de constancia. Las fotos de redes son el mejor día, con luz, ángulo y "pump" a favor, y no muestran cómo se llegó; compararte con tus propias fotos es la medida real.</p>
      </section>

      <section className="card stack">
        <h2 className="h2">Calorías y macros</h2>
        {plan ? (
          <>
            <div className="stat-tiles">
              <div className="stat-tile"><div className="stat-value">{n0(plan.bmr)}</div><div className="stat-label">metabolismo basal (kcal)</div></div>
              <div className="stat-tile"><div className="stat-value">{n0(plan.tdeeLow)}–{n0(plan.tdeeHigh)}</div><div className="stat-label">gasto diario estimado</div></div>
              <div className="stat-tile"><div className="stat-value">{n0(menu.kcal)}</div><div className="stat-label">objetivo (menú)</div></div>
            </div>
            <div className="macros"><span className="macro prot">{menu.protein} g<small>proteína</small></span><span className="macro carb">{plan.carbs}–{plan.carbs + 25} g<small>carb.</small></span><span className="macro fat">{plan.fat} g<small>grasas</small></span><span className="macro kcal">{plan.fiber}+ g<small>fibra</small></span></div>
            <p className="small muted">Metabolismo basal con Mifflin-St Jeor ({lastW} kg, {d.profile.heightCm} cm, {d.profile.age} años). Gasto diario = basal × {plan.factor} (pasos promedio {n0(stepsAvg)} + 5 días de pesas): es una estimación con margen de ±10–15 %. El objetivo es un déficit de ~{plan.deficitPct} % (≈ 600–800 kcal), suficiente para bajar 0,5–1 % por semana sin perder fuerza. Lo que manda después es el control semanal, no la fórmula.</p>
          </>
        ) : <Empty>Completá peso, altura y edad en Ajustes → Perfil para calcular.</Empty>}
      </section>

      <section className="card stack">
        <h2 className="h2">Estructura de entrenamiento</h2>
        <p className="small">Elegí una <b>distribución híbrida torso / pierna de 5 días</b>: torso 3 veces (lunes, miércoles y viernes) y pierna 2 (martes y jueves). Comparada con push/pull/legs (cada músculo 1–2 veces por semana con 5 días) y con torso/pierna clásico de 4 días, permite entrenar hombros, pecho superior, espalda y brazos 2–3 veces por semana en sesiones de 60 minutos, que es tu prioridad, y dejar las piernas en volumen moderado con máquinas.</p>
        <table className="tbl">
          <thead><tr><th>Grupo</th><th>Series directas / semana{week ? '' : ' (bloque 2)'}</th></tr></thead>
          <tbody>{volume.map(([m, n]) => <tr key={m}><td>{m}</td><td>{n}</td></tr>)}</tbody>
        </table>
        <p className="tiny muted">Además cuentan las series indirectas (por ejemplo, tríceps en los press y bíceps en jalones y remos). Rango de referencia para hipertrofia: ~10–20 series por músculo por semana; se ajusta con la recuperación.</p>
      </section>

      <section className="card stack">
        <h2 className="h2">Bloques de 4 semanas</h2>
        {BLOCKS.map((b) => (
          <div key={b.n} className={`option ${block.n === b.n && d.applied ? 'suggested' : ''}`}>
            <button className="row between gap linklike" style={{ width: '100%', textDecoration: 'none' }} onClick={() => setOpen(open === b.n ? null : b.n)} aria-expanded={open === b.n}>
              <b>{b.n}. {b.name}</b><span className="small muted">semanas {b.weeks[0]}–{b.weeks[1]}</span>
            </button>
            <p className="small">{b.goal}</p>
            {open === b.n && (
              <ul className="list small">
                <li><b>Entrenamiento:</b> {b.priorityExtra ? '+1 serie en ejercicios prioritarios' : 'series completas'}; RIR {b.rir}{b.deloadWeek ? `; semana ${b.deloadWeek} de descarga` : ''}.</li>
                <li><b>Pasos:</b> {b.steps}</li>
                <li><b>Nutrición:</b> {b.nutrition}</li>
                <li><b>Recuperación:</b> {b.recovery}</li>
                <li><b>Indicadores:</b> {b.indicators}</li>
                <li><b>Cuándo modificar:</b> {b.modify}</li>
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2 className="h2">Pasos</h2>
        <p className="small">Empezás en tu promedio actual (≈ {n0(stepsStart)}) y subís <b>500 por semana</b> solo si cumpliste 5 de 7 días, sin dolor y con buen sueño, hasta <b>15.000</b> (≈ semana 9–10). Ritmo: caminata en la que puedas hablar.{has(/falta de aire/) ? ' Como el aeróbico intenso te da falta de aire, por ahora nada de correr ni caminar muy rápido.' : ''}</p>
        <ul className="list small">
          <li>10 minutos después del almuerzo y de la cena (ayuda a la glucemia y suma ~2.000 pasos).</li>
          <li>Días de gimnasio: caminá hasta el gimnasio si podés; la caminata larga (30–45 min) a la tarde.</li>
          <li>Días de pierna o de mucho cansancio: está bien quedar 1.000–2.000 pasos abajo.</li>
          <li>Si pasás mucho tiempo sentado: pararte 2–3 minutos cada hora.{has(/compresi/) ? ' Medias de compresión en las caminatas largas.' : ''}</li>
        </ul>
      </section>

      <section className="card stack">
        <h2 className="h2">Hidratación</h2>
        <p className="small">Cuatro litros por día no son obligatorios. Como referencia, un hombre adulto necesita alrededor de <b>2,5–3,5 L de bebidas por día</b>, más con calor, transpiración y entrenamiento. Una guía práctica: tomar con sed y con cada comida, más 500–750 ml alrededor del gimnasio, y que la orina sea amarillo claro. Si orinás muy seguido, no hace falta forzar más: repartí el líquido en el día y bajá la cantidad a la noche para dormir mejor. Si la frecuencia sigue alta tomando menos, comentalo con tu médico.</p>
        <p className="small muted">Limón, pepino o jengibre: dan sabor y te pueden ayudar a tomar agua sin azúcar. No queman grasa ni "desintoxican". El limón y el jengibre pueden dar acidez a algunas personas.</p>
      </section>

      <section className="card stack">
        <h2 className="h2">Sueño y recuperación</h2>
        <p className="small"><b>Objetivo: 7–9 horas.</b> Dormir poco empeora la recuperación y la fuerza, aumenta el hambre (sobre todo de cosas dulces) y hace que más del peso perdido salga de músculo.</p>
        <ul className="list small">
          <li>Levantarte siempre a las 08:00, también el fin de semana, y salir a la luz 10 minutos.</li>
          <li>Adelantar la hora de acostarte 30 minutos por semana: 01:30 → 01:00 → 00:30 → 00:00.</li>
          <li>Último mate o café a las 16:00 (el mate tiene cafeína). Última hora del día: luz baja y sin pantallas en la cama.</li>
          <li>Señales de fatiga: fuerza que baja 2 sesiones seguidas, dolores que no se van, pulsaciones en reposo más altas que tu promedio, mal humor o poco sueño. Ese día: "Hoy estoy cansado" u omitir con motivo.</li>
          {has(/ronc/) && <li><b>Ronquidos fuertes + cansancio aunque duermas</b>: vale la pena consultar por apnea del sueño (un estudio de sueño). Es frecuente, tiene tratamiento y mejora la energía y la recuperación.</li>}
        </ul>
      </section>

      <section className="card stack">
        <h2 className="h2">Expectativas realistas</h2>
        {proj.length ? (
          <table className="tbl">
            <thead><tr><th>Días</th><th>Conservador</th><th>Realista</th><th>Favorable</th></tr></thead>
            <tbody>{proj.map((p) => <tr key={p.days}><td>{p.days}</td><td>{n1(p.conservador)} kg</td><td>{n1(p.realista)} kg</td><td>{n1(p.favorable)} kg</td></tr>)}</tbody>
          </table>
        ) : <Empty>Registrá tu peso para ver la proyección.</Empty>}
        <p className="small muted">Ritmos de 0,4 %, 0,7 % y 1 % por semana desde tu último peso, sin contar semanas de descarga. Son rangos, no promesas: el peso fluctúa por agua, sal e intestino. El abdomen suele bajar ~0,5–1 cm por cada kg perdido. La memoria muscular (haber entrenado de joven) suele ayudar a recuperar masa más rápido, pero no hay garantía de cuánto.{lastWaist && d.profile.heightCm ? ` Tu relación cintura/altura hoy es ${waistToHeight(lastWaist, d.profile.heightCm)}; por debajo de 0,5 se considera saludable.` : ''}</p>
        <p className="small muted">Abdominales visibles en 6 meses no son esperables partiendo de este punto. Sí son esperables: menos abdomen y flancos, cara más definida, más fuerza, hombros y espalda más marcados y mejor postura.</p>
      </section>

      <section className="card stack">
        <h2 className="h2">Salud</h2>
        <ul className="list small">
          <li>Si aparece falta de aire que no se va al parar, dolor de pecho o mareo: cortá y consultá.</li>
          {has(/asma|inhalador/) && <li>Tené el inhalador a mano en el gimnasio y usalo como te indicó tu médico.</li>}
          {has(/pulsacion|frecuencia card/) && <li>Pulsaciones en reposo: con mejor forma física suelen bajar. Si siguen altas o suben, comentalo en tu próximo control (la app las muestra si conectás el reloj).</li>}
          {has(/varic|venos/) && <li>Molestias venosas: seguí las indicaciones de tu médico (por ejemplo, medias), exhalá al empujar y no hagas series al fallo en pierna.</li>}
          <li>La app no reemplaza la evaluación médica. Tus antecedentes están en Ajustes → Perfil.</li>
        </ul>
      </section>
    </>
  );
}
