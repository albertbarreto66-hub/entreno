import { useEffect, useState } from 'react';
import { useNav } from '../App';
import { NumInput } from '../components/NumInput';
import { Chip, CountUp, Field, IconBadge, Segmented, Sheet, useConfirm, useToast } from '../components/ui';
import { IconBowl, IconCup, IconMoon, IconPlus, IconSun } from '../components/icons';

const SLOT_ICON: Record<string, React.ReactNode> = { desayuno: <IconSun />, almuerzo: <IconBowl />, merienda: <IconCup />, cena: <IconMoon />, extra: <IconPlus /> };
import { FOOD_BY_ID, FOODS, foodLabel } from '../data/foods';
import { DINNER_EXCLUDED, MENU, OPTIONS, PREP_DAYS, type MainSlot, type MenuMeal } from '../data/menu';
import { getSettings, patchSettings } from '../lib/app';
import { timeHM, weekday } from '../lib/dates';
import { all, byDate, del, get, kvGet, kvSet, put } from '../lib/db';
import { n0 } from '../lib/format';
import { goalFor } from '../lib/goals';
import { useLive } from '../lib/hooks';
import { compressImage, isQuotaError } from '../lib/image';
import { logPlanMeal, newMealLog, planMealFor } from '../lib/meals';
import { dayLogTotals, itemTotals, mealLogTotals, mealVariant, menuDayForWeekday, menuDayTotals, prepTasks, shoppingList, substitutes, sumItems } from '../lib/nutrition';
import { uid } from '../lib/format';
import { MAIN_SLOTS, SLOT_LABEL, type FoodItem, type MealLog, type MealSlot } from '../lib/types';

type Tab = 'dia' | 'menu' | 'compras' | 'prep';

export function Meals() {
  const { date, sub, go } = useNav();
  const [tab, setTab] = useState<Tab>('dia');
  const data = useLive(async () => {
    const [meals, settings, goals] = await Promise.all([byDate('meals', date), getSettings(), all('goals')]);
    return { meals: meals.sort((a, b) => a.createdAt - b.createdAt), settings, goals };
  }, [date]);
  const [editing, setEditing] = useState<MealLog | null>(null);
  const [choosing, setChoosing] = useState<MainSlot | null>(null);

  // Rutas desde Hoy: registrar / editar-<slot> / otra-<slot>
  useEffect(() => {
    if (!sub || !data) return;
    const slotByTime = (): MealSlot => { const t = timeHM(Date.now()); return t < '10:30' ? 'desayuno' : t < '15:00' ? 'almuerzo' : t < '19:00' ? 'merienda' : 'cena'; };
    if (sub === 'registrar') setEditing(newMealLog(date, slotByTime()));
    else if (sub.startsWith('editar-')) {
      const slot = sub.slice(7) as Exclude<MealSlot, 'extra'>;
      const p = planMealFor(date, slot, data.settings.preferNoEgg);
      setEditing(newMealLog(date, slot, { title: p.variant.title + ' (modificado)', items: p.variant.items.map((i) => ({ ...i })), fromPlan: { day: p.day, slot, noEgg: p.usedNoEgg } }));
    } else if (sub.startsWith('otra-')) setEditing(newMealLog(date, sub.slice(5) as MealSlot));
    else if (sub.startsWith('opciones-')) setChoosing(sub.slice(9) as MainSlot);
    setTab('dia');
    go('comidas');
  }, [sub, data, date, go]);

  if (!data) return null;
  return (
    <div className="stack-lg">
      <Segmented label="Sección" value={tab} onChange={setTab} options={[{ value: 'dia', label: 'Registro' }, { value: 'menu', label: 'Menú' }, { value: 'compras', label: 'Compras' }, { value: 'prep', label: 'Preparación' }]} />
      {tab === 'dia' && <DayMeals {...data} date={date} onEdit={setEditing} onChoose={setChoosing} />}
      {tab === 'menu' && <MenuView dairy={data.settings.dairyEnabled} preferNoEgg={data.settings.preferNoEgg} today={date} />}
      {tab === 'compras' && <Shopping noEgg={data.settings.preferNoEgg} />}
      {tab === 'prep' && <Prep />}
      <p className="small muted">Calorías y proteínas son estimaciones con un catálogo local de valores aproximados (principalmente USDA FoodData Central, SR Legacy). Las referencias de 2.500–2.700 kcal y 160–190 g de proteína son iniciales y editables, no una prescripción médica.</p>
      {editing && <MealEditor meal={editing} dairy={data.settings.dairyEnabled} onClose={() => setEditing(null)} />}
      {choosing && <OptionsSheet slot={choosing} date={date} noEgg={data.settings.preferNoEgg} onClose={() => setChoosing(null)}
        onModify={(m) => { setChoosing(null); setEditing(m); }} />}
    </div>
  );
}

function DayMeals({ meals, settings, goals, date, onEdit, onChoose }: { meals: MealLog[]; settings: Awaited<ReturnType<typeof getSettings>>; goals: Awaited<ReturnType<typeof all<'goals'>>>; date: string; onEdit: (m: MealLog) => void; onChoose: (s: MainSlot) => void }) {
  const confirm = useConfirm();
  const tot = dayLogTotals(meals);
  const kcalRef = goalFor(goals, 'kcal', date), protRef = goalFor(goals, 'protein', date);
  return (
    <>
      <section className="card">
        <h2 className="h2">Total registrado</h2>
        <div className="macros" style={{ margin: '4px 0 8px' }}><span className="macro kcal" style={{ fontSize: '1.3rem' }}><CountUp value={tot.kcal} /><small>kcal</small></span><span className="macro prot" style={{ fontSize: '1.3rem' }}><CountUp value={tot.protein} /> g<small>proteína</small></span></div>
        <p className="small muted">Referencia inicial editable: {kcalRef ? `${n0(kcalRef)} kcal${kcalRef === 2600 ? " (rango inicial 2.500–2.700)" : ""}` : 'sin referencia'} · {protRef ? `${n0(protRef)} g proteína` : 'sin referencia'}.{tot.withoutData ? ` ${tot.withoutData} comida(s) sin datos nutricionales (texto libre): no se estiman.` : ''}</p>
        <label className="switch"><input type="checkbox" checked={settings.preferNoEgg} onChange={(e) => patchSettings({ preferNoEgg: e.target.checked })} /><span>Usar siempre la alternativa sin huevo</span></label>
      </section>
      {[...MAIN_SLOTS, 'extra' as MealSlot].map((slot) => {
        const logs = meals.filter((m) => m.slot === slot);
        const plan = slot !== 'extra' ? planMealFor(date, slot as Exclude<MealSlot, 'extra'>, settings.preferNoEgg) : null;
        if (slot === 'extra' && !logs.length) return (
          <button key="extra" className="btn secondary block" onClick={() => onEdit(newMealLog(date, 'extra'))}>+ Registrar otra comida (colación, extra)</button>
        );
        return (
          <section key={slot} className="card stack">
            <div className="row between">
              <h2 className="h2"><IconBadge tone="meal" size="sm">{SLOT_ICON[slot]}</IconBadge>{SLOT_LABEL[slot]}</h2>
              {logs.length ? <Chip tone="green">✓ Registrado</Chip> : <Chip tone="gray">Pendiente</Chip>}
            </div>
            {logs.map((m) => {
              const t = mealLogTotals(m);
              return (
                <div key={m.id} className="logged">
                  <div className="row between">
                    <b>{m.title || m.freeText || 'Comida'}</b>
                    <span className="small">{t.kcal != null ? `${n0(t.kcal)} kcal · ${n0(t.protein ?? 0)} g` : 'sin estimación'}{t.estimated === 'manual' ? ' (cargado por vos)' : ''}</span>
                  </div>
                  {m.items.length > 0 && <p className="small muted">{m.items.map((i) => `${FOOD_BY_ID[i.foodId]?.name ?? i.foodId} ${i.grams} g`).join(' · ')}</p>}
                  {(m.hunger || m.satiety || m.bloating != null) && <p className="small muted">{m.hunger ? `Hambre ${m.hunger}/5 · ` : ''}{m.satiety ? `Saciedad ${m.satiety}/5 · ` : ''}{m.bloating != null ? `Hinchazón ${['nada', 'leve', 'moderada', 'fuerte'][m.bloating]}` : ''}</p>}
                  {m.photoId && <MealPhoto id={m.photoId} />}
                  <div className="row gap">
                    <button className="btn ghost small" onClick={() => onEdit(structuredClone(m))}>Editar</button>
                    <button className="btn ghost small" onClick={async () => { if (await confirm({ title: 'Borrar esta comida?', body: m.title, ok: 'Borrar', danger: true })) { if (m.photoId) await del('photos', m.photoId); await del('meals', m.id); } }}>Borrar</button>
                  </div>
                </div>
              );
            })}
            {plan && (
              <div className="plan">
                <p className="eyebrow">Plan · {MENU.find((d) => d.day === plan.day)?.name}</p>
                <p><b>{plan.variant.title}</b>{plan.usedNoEgg && <span className="small muted"> (sin huevo)</span>}</p>
                <PlanItems items={plan.variant.items} />
                <div className="row gap wrap">
                  <button className="btn primary" onClick={() => logPlanMeal(date, slot as Exclude<MealSlot, 'extra'>, settings.preferNoEgg)}>Comí esto</button>
                  <button className="btn secondary" onClick={() => onEdit(newMealLog(date, slot, { title: plan.variant.title + ' (modificado)', items: plan.variant.items.map((i) => ({ ...i })), fromPlan: { day: plan.day, slot, noEgg: plan.usedNoEgg } }))}>Modificar</button>
                  <button className="btn ghost" onClick={() => onChoose(slot as MainSlot)}>Ver {OPTIONS[slot as MainSlot].length} opciones</button>
                  <button className="btn ghost" onClick={() => onEdit(newMealLog(date, slot))}>Registrar otra</button>
                </div>
                {plan.meal.noEgg && !settings.preferNoEgg && (
                  <p className="small">Alternativa sin huevo: {plan.meal.noEgg.title}{' '}
                    <button className="linklike" onClick={() => logPlanMeal(date, slot as Exclude<MealSlot, 'extra'>, true)}>Comí la versión sin huevo</button></p>
                )}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

function PlanItems({ items }: { items: FoodItem[] }) {
  const t = sumItems(items);
  return (
    <>
      <ul className="items">
        {items.map((it, i) => {
          const f = FOOD_BY_ID[it.foodId];
          const tt = itemTotals(it);
          return <li key={i}><span>{f.name} <span className="muted small">({f.state})</span></span><span>{it.grams} g</span><span className="muted small">{n0(tt.kcal)} kcal · {tt.protein.toFixed(1).replace('.', ',')} g</span></li>;
        })}
      </ul>
      <div className="macros"><span className="macro kcal">≈ {n0(t.kcal)}<small>kcal</small></span><span className="macro prot">{n0(t.protein)} g<small>proteína</small></span></div>
    </>
  );
}

function MealPhoto({ id }: { id: string }) {
  const rec = useLive(() => get('photos', id), [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (!rec) return; const u = URL.createObjectURL(rec.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [rec]);
  return url ? <img className="mealphoto" src={url} alt="Foto de la comida" /> : null;
}

function MealEditor({ meal, dairy, onClose }: { meal: MealLog; dairy: boolean; onClose: () => void }) {
  const [m, setM] = useState<MealLog>(meal);
  const [addId, setAddId] = useState('');
  const [mode, setMode] = useState<'catalogo' | 'libre'>(meal.items.length || !meal.freeText ? 'catalogo' : 'libre');
  const [subFor, setSubFor] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const foods = FOODS.filter((f) => dairy || !f.dairy);
  const t = sumItems(m.items);
  const set = (p: Partial<MealLog>) => setM((x) => ({ ...x, ...p }));
  const setItem = (i: number, p: Partial<FoodItem>) => setM((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...p } : it)) }));
  const [isNew, setIsNew] = useState(true);
  useEffect(() => { get('meals', meal.id).then((x) => setIsNew(!x)); }, [meal.id]);

  const save = async () => {
    if (mode === 'libre' && !m.freeText?.trim()) { toast('Escribí qué comiste.', 'error'); return; }
    if (mode === 'catalogo' && !m.items.length) { toast('Agregá al menos un alimento o usá texto libre.', 'error'); return; }
    if (m.items.some((i) => !(i.grams > 0))) { toast('Revisá los gramos.', 'error'); return; }
    const out: MealLog = mode === 'libre' ? { ...m, items: [], title: m.title || (m.freeText ?? '').slice(0, 60) } : { ...m, freeText: undefined, manualKcal: null, manualProtein: null, title: m.title || 'Comida' };
    const existing = await get('meals', m.id);
    if (existing && existing.updatedAt !== meal.updatedAt) {
      if (!(await confirm({ title: 'Esta comida cambió mientras la editabas', body: '¿Guardar tu versión igual?', ok: 'Guardar mi versión' }))) return;
    }
    await put('meals', { ...out, updatedAt: Math.max(Date.now(), out.updatedAt + 1) });
    onClose();
  };

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const c = await compressImage(file, 1280, 0.8);
      const id = uid();
      await put('photos', { id, kind: 'comida', date: m.date, blob: c.blob, type: c.type, width: c.width, height: c.height, at: Date.now() });
      if (m.photoId) await del('photos', m.photoId);
      set({ photoId: id });
    } catch (e) {
      toast(isQuotaError(e) ? 'No hay espacio suficiente para guardar la foto. Exportá un respaldo y borrá fotos viejas.' : (e as Error).message, 'error');
    }
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Registrar comida' : 'Editar comida'}>
      <div className="row gap">
        <Field label="Comida">
          <select value={m.slot} onChange={(e) => set({ slot: e.target.value as MealSlot })}>
            {(['desayuno', 'almuerzo', 'merienda', 'cena', 'extra'] as MealSlot[]).map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Nombre"><input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej.: Pollo con arroz" /></Field>
      </div>
      <Segmented label="Forma de registro" value={mode} onChange={setMode} options={[{ value: 'catalogo', label: 'Con alimentos y gramos' }, { value: 'libre', label: 'Texto libre' }]} />

      {mode === 'catalogo' ? (
        <>
          <ul className="edit-items">
            {m.items.map((it, i) => {
              const f = FOOD_BY_ID[it.foodId];
              const tt = itemTotals(it);
              const subs = subFor === i ? substitutes(it, { dairy }) : [];
              return (
                <li key={i}>
                  <div className="row between gap">
                    <span className="grow">{f ? foodLabel(f) : it.foodId}</span>
                    <NumInput className="grams" label={`Gramos de ${f?.name}`} value={it.grams} integer max={3000} onCommit={(v) => setItem(i, { grams: v ?? 0 })} />
                    <span className="small">g</span>
                    <button className="btn ghost small" aria-label={`Quitar ${f?.name}`} onClick={() => set({ items: m.items.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                  <div className="row between small muted">
                    <span>{n0(tt.kcal)} kcal · {tt.protein.toFixed(1).replace('.', ',')} g prot.</span>
                    <button className="linklike" onClick={() => setSubFor(subFor === i ? null : i)}>{subFor === i ? 'Cerrar' : 'Sustituir'}</button>
                  </div>
                  {subFor === i && (
                    <div className="subs">
                      <p className="small muted">Porciones comparables ({f.group === 'proteina' || f.group === 'lacteo' ? 'misma proteína' : f.group === 'verdura' ? 'mismo peso' : 'mismas calorías'}):</p>
                      {subs.length ? subs.map((s) => (
                        <button key={s.food.id} className="btn ghost small" onClick={() => { setItem(i, { foodId: s.food.id, grams: s.grams }); setSubFor(null); }}>{s.food.name} ({s.food.state}) {s.grams} g</button>
                      )) : <p className="small">Sin sustitutos en el catálogo.</p>}
                    </div>
                  )}
                  <p className="tiny muted">Fuente: {f?.source}</p>
                </li>
              );
            })}
          </ul>
          <div className="row gap">
            <select aria-label="Agregar alimento" value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">Agregar alimento…</option>
              {foods.map((f) => <option key={f.id} value={f.id}>{foodLabel(f)}</option>)}
            </select>
            <button className="btn secondary" disabled={!addId} onClick={() => { set({ items: [...m.items, { foodId: addId, grams: FOOD_BY_ID[addId].unit?.grams ?? 100 }] }); setAddId(''); }}>Agregar</button>
          </div>
          <p><b>≈ {n0(t.kcal)} kcal · {n0(t.protein)} g proteína</b></p>
        </>
      ) : (
        <>
          <Field label="¿Qué comiste?"><textarea rows={3} value={m.freeText ?? ''} onChange={(e) => set({ freeText: e.target.value })} placeholder="Ej.: dos empanadas de carne en la oficina" /></Field>
          <p className="small muted">Con texto libre no se calculan nutrientes: no hay datos suficientes. Si conocés los valores (por ejemplo, de una etiqueta), podés cargarlos.</p>
          <div className="row gap">
            <Field label="kcal (opcional)"><NumInput label="kcal" value={m.manualKcal ?? null} integer max={5000} onCommit={(v) => set({ manualKcal: v })} /></Field>
            <Field label="Proteína g (opcional)"><NumInput label="Proteína en gramos" value={m.manualProtein ?? null} max={400} onCommit={(v) => set({ manualProtein: v })} /></Field>
          </div>
        </>
      )}

      <details>
        <summary>Hambre, saciedad e hinchazón (opcional)</summary>
        <div className="stack">
          <Field label="Hambre antes (1–5)"><Segmented label="Hambre" value={m.hunger ?? 0} onChange={(v) => set({ hunger: v || null })} options={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v ? String(v) : '–' }))} /></Field>
          <Field label="Saciedad después (1–5)"><Segmented label="Saciedad" value={m.satiety ?? 0} onChange={(v) => set({ satiety: v || null })} options={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v ? String(v) : '–' }))} /></Field>
          <Field label="Hinchazón"><Segmented label="Hinchazón" value={m.bloating ?? -1} onChange={(v) => set({ bloating: v < 0 ? null : v })} options={[{ value: -1, label: '–' }, { value: 0, label: 'Nada' }, { value: 1, label: 'Leve' }, { value: 2, label: 'Mod.' }, { value: 3, label: 'Fuerte' }]} /></Field>
        </div>
      </details>
      <Field label="Foto de la comida (opcional)" hint="La foto es solo un recordatorio: no permite conocer las calorías.">
        <input type="file" accept="image/*" onChange={(e) => addPhoto(e.target.files?.[0])} />
      </Field>
      {m.photoId && <MealPhoto id={m.photoId} />}
      <Field label="Notas"><input value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <button className="btn primary block lg" onClick={save}>Guardar comida</button>
    </Sheet>
  );
}

function MenuView({ dairy, preferNoEgg, today }: { dairy: boolean; preferNoEgg: boolean; today: string }) {
  const [day, setDay] = useState(menuDayForWeekday(weekday(today)));
  const d = MENU.find((x) => x.day === day)!;
  const tot = menuDayTotals(day, preferNoEgg);
  const [subsOpen, setSubsOpen] = useState<string | null>(null);
  return (
    <>
      <div className="daypick" role="tablist" aria-label="Día del menú">
        {MENU.map((x) => <button key={x.day} role="tab" aria-selected={x.day === day} className={x.day === day ? 'on' : ''} onClick={() => setDay(x.day)}>{x.name.slice(0, 3)}</button>)}
      </div>
      <section className="card">
        <h2 className="h2">{d.name}</h2>
        <p><b>≈ {n0(tot.kcal)} kcal · {n0(tot.protein)} g proteína</b> <span className="small muted">(calculado con el catálogo{preferNoEgg ? ', versión sin huevo' : ''})</span></p>
      </section>
      {MAIN_SLOTS.map((slot) => {
        const meal = d.meals[slot as Exclude<MealSlot, 'extra'>];
        const v = mealVariant(meal, preferNoEgg);
        return (
          <section key={slot} className="card stack">
            <p className="eyebrow">{SLOT_LABEL[slot]}</p>
            <h3 className="h3">{v.title}</h3>
            <PlanItems items={v.items} />
            <p className="small"><b>Receta:</b> {v.recipe}</p>
            {meal.noEgg && !preferNoEgg && (
              <details><summary>Alternativa sin huevo</summary><p><b>{meal.noEgg.title}</b></p><PlanItems items={meal.noEgg.items} /><p className="small">{meal.noEgg.recipe}</p></details>
            )}
            {meal.dairyOption && dairy && <p className="small">Opcional con lácteos: {meal.dairyOption.label} ({meal.dairyOption.items.map((i) => `${FOOD_BY_ID[i.foodId].name} ${i.grams} g`).join(', ')}, +{n0(sumItems(meal.dairyOption.items).kcal)} kcal)</p>}
            <button className="linklike" onClick={() => setSubsOpen(subsOpen === slot ? null : slot)}>{subsOpen === slot ? 'Ocultar sustituciones' : 'Ver sustituciones'}</button>
            {subsOpen === slot && (
              <ul className="small list plain">
                {v.items.map((it, i) => {
                  const subs = substitutes(it, { dairy }).slice(0, 4);
                  if (!subs.length) return null;
                  return <li key={i}><b>{FOOD_BY_ID[it.foodId].name} {it.grams} g</b> → {subs.map((s) => `${s.food.name} ${s.grams} g`).join(' · ')}</li>;
                })}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

function Shopping({ noEgg }: { noEgg: boolean }) {
  const groups = shoppingList(undefined, noEgg);
  const checked = useLive(() => kvGet<string[]>('shoppingChecked'), []) ?? [];
  const toggle = (id: string) => kvSet('shoppingChecked', checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id], true);
  const names: Record<string, string> = { proteina: 'Proteínas', carbohidrato: 'Panificados, cereales y tubérculos', fruta: 'Frutas', verdura: 'Verduras', grasa: 'Aceite, palta y frutos secos', otro: 'Otros', lacteo: 'Lácteos' };
  const fmtG = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg` : `${g} g`);
  return (
    <>
      <section className="card"><h2 className="h2">Lista semanal de compras</h2><p className="small muted">Cantidades del menú de 7 días en el estado indicado (crudo, cocido o listo). Las legumbres figuran cocidas: comprá ~40% de ese peso en seco.</p>
        {checked.length > 0 && <button className="btn ghost small" onClick={() => kvSet('shoppingChecked', [], true)}>Desmarcar todo</button>}</section>
      {Object.entries(groups).map(([g, items]) => (
        <section key={g} className="card">
          <h3 className="h3">{names[g]}</h3>
          <ul className="list plain">
            {items.map(({ food, grams }) => (
              <li key={food.id}>
                <label className="switch"><input type="checkbox" checked={checked.includes(food.id)} onChange={() => toggle(food.id)} />
                  <span className={checked.includes(food.id) ? 'strike' : ''}>{food.name} ({food.state}) — <b>{fmtG(grams)}</b>{food.unit ? <span className="muted small"> ≈ {Math.ceil(grams / food.unit.grams)} {food.unit.label}{grams / food.unit.grams > 1 ? 's' : ''}</span> : null}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Prep() {
  return (
    <>
      {PREP_DAYS.map((p) => (
        <section key={p.name} className="card">
          <h2 className="h2">Preparación del {p.name.toLowerCase()}</h2>
          <p className="small muted">{p.note}</p>
          <ol className="list">{prepTasks(p.covers).map((t, i) => <li key={i}>{t}</li>)}</ol>
        </section>
      ))}
      <section className="card small muted">Guardá lo cocido en heladera en recipientes cerrados y consumilo dentro de 3–4 días. Lo que no vayas a usar en ese plazo, freezalo.</section>
    </>
  );
}

/** Todas las opciones de una comida, intercambiables, con calorías y proteína calculadas. */
function OptionsSheet({ slot, date, noEgg, onClose, onModify }: { slot: MainSlot; date: string; noEgg: boolean; onClose: () => void; onModify: (m: MealLog) => void }) {
  const toast = useToast();
  const plan = planMealFor(date, slot, noEgg);
  const day = plan.day;
  const toLog = (o: MenuMeal) => {
    const v = mealVariant(o, noEgg);
    return newMealLog(date, slot, { title: v.title, items: v.items.map((i) => ({ ...i })), fromPlan: { day, slot, noEgg: noEgg && !!o.noEgg, optionId: o.id } });
  };
  return (
    <Sheet open onClose={onClose} title={`Opciones de ${SLOT_LABEL[slot].toLowerCase()}`}>
      {slot === 'cena' && <p className="note small">Cenas sin carbohidratos: carne, pollo o pescado con ensaladas o verduras.</p>}
      <p className="small muted">Todas tienen calorías y proteína parecidas, así que podés cambiar una por otra sin desarmar el día.</p>
      {OPTIONS[slot].map((o) => {
        const v = mealVariant(o, noEgg);
        const t = sumItems(v.items);
        return (
          <div key={o.id} className={`option ${o.id === plan.meal.id ? 'suggested' : ''}`}>
            <div className="row between"><b>{v.title}</b>{o.id === plan.meal.id && <Chip tone="green">Sugerida hoy</Chip>}</div>
            <p className="small muted">{v.items.map((it) => `${FOOD_BY_ID[it.foodId].name} ${it.grams} g`).join(' · ')}</p>
            <div className="macros"><span className="macro kcal">≈ {n0(t.kcal)}<small>kcal</small></span><span className="macro prot">{n0(t.protein)} g<small>proteína</small></span></div>
            <p className="small">{v.recipe}</p>
            <div className="row gap wrap">
              <button className="btn primary small" onClick={async () => { await logPlanMeal(date, slot, noEgg, day, o.id); toast(`${SLOT_LABEL[slot]} registrado`); onClose(); }}>Comí esto</button>
              <button className="btn ghost small" onClick={() => onModify(toLog(o))}>Modificar</button>
            </div>
          </div>
        );
      })}
      <p className="tiny muted">Alimentos que no se usan en la cena: {DINNER_EXCLUDED.map((id) => FOOD_BY_ID[id]?.name).filter(Boolean).join(', ')}.</p>
    </Sheet>
  );
}
