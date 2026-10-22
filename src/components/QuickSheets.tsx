import { useEffect, useState } from 'react';
import { FLAVORED_NOTE, FLAVORED_WATERS } from '../data/menu';
import { KIND_LABEL } from '../health/classify';
import { hasHealthBridge } from '../health/plugin';
import { timeHM } from '../lib/dates';
import { byDate, del, patchDay, put } from '../lib/db';
import { n0, n1, parseIntLoose, parseNum, uid } from '../lib/format';
import type { DaySummary } from '../lib/summary';
import type { FluidKind } from '../lib/types';
import { Chip, Field, Segmented, Sheet, useConfirm, useToast } from './ui';

export function sourceChip(origin: string | null) {
  if (!origin) return <Chip tone="gray">Sin datos</Chip>;
  const label = origin === 'importado' ? 'Importado' : KIND_LABEL[origin as keyof typeof KIND_LABEL] ?? origin;
  const tone = origin === 'manual' ? 'amber' : origin === 'garmin' ? 'blue' : 'neutral';
  return <Chip tone={tone}>{label}</Chip>;
}

// ---------------- Líquidos ----------------
export function WaterSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DaySummary }) {
  const [kind, setKind] = useState<FluidKind>('agua');
  const [flavor, setFlavor] = useState(FLAVORED_WATERS[0].id);
  const [custom, setCustom] = useState('');
  const [otherLabel, setOtherLabel] = useState('');
  const [note, setNote] = useState(s.day.fluidNote ?? '');
  const confirm = useConfirm();
  const toast = useToast();
  useEffect(() => { if (open) setNote(s.day.fluidNote ?? ''); }, [open, s.day.fluidNote]);

  const add = async (ml: number) => {
    if (!(ml > 0 && ml <= 3000)) { toast('Ingresá una cantidad entre 1 y 3000 ml.', 'error'); return; }
    const label = kind === 'saborizada' ? FLAVORED_WATERS.find((f) => f.id === flavor)?.label : kind === 'otra' ? otherLabel.trim() || 'Otra bebida' : 'Agua';
    await put('fluids', { id: uid(), date: s.date, ml, kind, label, at: Date.now() });
    setCustom('');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Líquidos">
      <p className="big-number">{n0(s.fluidTotal)} ml <span className="muted small">registrados{s.fluidGoal ? ` · meta personal ${n0(s.fluidGoal)} ml` : ''}</span></p>
      <Segmented label="Tipo de bebida" value={kind} onChange={setKind} options={[{ value: 'agua', label: 'Agua' }, { value: 'saborizada', label: 'Saborizada' }, { value: 'otra', label: 'Otra' }]} />
      {kind === 'saborizada' && (
        <div className="stack">
          <Field label="Sabor">
            <select value={flavor} onChange={(e) => setFlavor(e.target.value)}>
              {FLAVORED_WATERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <p className="small muted">{FLAVORED_WATERS.find((f) => f.id === flavor)?.how}</p>
          <p className="note small">{FLAVORED_NOTE}</p>
        </div>
      )}
      {kind === 'otra' && <Field label="¿Qué bebida?"><input value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} placeholder="Ej.: mate, café, gaseosa sin azúcar" /></Field>}
      <div className="row gap">
        <button className="btn primary grow" onClick={() => add(250)}>+250 ml</button>
        <button className="btn primary grow" onClick={() => add(500)}>+500 ml</button>
      </div>
      <div className="row gap">
        <input aria-label="Cantidad personalizada en ml" inputMode="numeric" placeholder="Otra cantidad (ml)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="btn secondary" onClick={() => add(parseIntLoose(custom) ?? 0)} disabled={!custom}>Agregar</button>
      </div>
      {s.fluids.length > 0 && (
        <ul className="list">
          {s.fluids.map((f) => (
            <li key={f.id} className="row between">
              <span>{timeHM(f.at)} · {f.label ?? f.kind} · <b>{n0(f.ml)} ml</b></span>
              <button className="btn ghost small" onClick={async () => { if (await confirm({ title: 'Borrar este registro?', body: `${f.label} ${f.ml} ml`, ok: 'Borrar', danger: true })) del('fluids', f.id); }}>Borrar</button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Nota opcional (frecuencia para orinar, molestias)">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (s.day.fluidNote ?? '') && patchDay(s.date, { fluidNote: note })} />
      </Field>
      <p className="small muted">Cuánto líquido necesitás depende del calor, la actividad y cuánto transpirás. No hace falta llegar a una cantidad fija ni superar tu meta; la meta es opcional y la definís en Ajustes.</p>
    </Sheet>
  );
}

// ---------------- Pasos ----------------
export function StepsSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DaySummary }) {
  const [v, setV] = useState('');
  const confirm = useConfirm();
  const toast = useToast();
  useEffect(() => { if (open) setV(''); }, [open]);
  const save = async () => {
    const n = parseIntLoose(v);
    if (n == null || n > 100000) { toast('Ingresá un número de pasos válido.', 'error'); return; }
    const cur = s.day.stepsManual;
    if (cur != null) {
      const r = await confirm({ title: 'Ya cargaste pasos hoy', body: `Registro manual actual: ${n0(cur)}. ¿Qué querés hacer con ${n0(n)}?`, ok: `Reemplazar por ${n0(n)}`, extra: [{ label: `Sumar (total ${n0(cur + n)})`, value: 'sum' }] });
      if (!r) return;
      await patchDay(s.date, { stepsManual: r === 'sum' ? cur + n : n });
    } else await patchDay(s.date, { stepsManual: n });
    onClose();
  };
  const st = s.steps;
  return (
    <Sheet open={open} onClose={onClose} title="Pasos">
      <p className="big-number">{st.value != null ? n0(st.value) : 'Sin datos'} {sourceChip(st.origin)}</p>
      {s.stepGoal != null && <p className="muted">Meta del día: {n0(s.stepGoal)} pasos{s.stepsMet ? ' · alcanzada ✓' : ''}</p>}
      <ul className="small list plain">
        <li>Reloj (Garmin vía Salud): {st.watch != null ? n0(st.watch) : 'sin datos disponibles'}</li>
        <li>iPhone: {st.phone != null ? n0(st.phone) : 'sin datos disponibles'}</li>
        <li>Manual: {st.manual != null ? n0(st.manual) : 'sin registro'}</li>
      </ul>
      {s.settings.stepGoalBasis === 'reloj' && <p className="note small">La meta se evalúa solo con datos del reloj: los registros manuales se guardan pero no la completan.</p>}
      <Field label="Registrar pasos manualmente (total del día)">
        <input inputMode="numeric" placeholder="Ej.: 9500" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <div className="row gap">
        <button className="btn primary grow" onClick={save} disabled={!v}>Guardar</button>
        {st.manual != null && <button className="btn ghost" onClick={async () => { if (await confirm({ title: 'Borrar el registro manual de pasos?', ok: 'Borrar', danger: true })) { await patchDay(s.date, { stepsManual: null }); } }}>Borrar manual</button>}
      </div>
      <p className="small muted">
        {hasHealthBridge() ? 'Los datos del reloj se importan desde Salud en Ajustes › Salud.' : 'En el navegador no hay conexión con Salud, Garmin ni sensores: el registro es manual. La importación desde Garmin requiere la versión iOS.'}
        {' '}No se muestra distancia porque no hay un dato real de distancia.
      </p>
    </Sheet>
  );
}

// ---------------- Peso y cintura ----------------
export function WeightSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [w, setW] = useState('');
  const [c, setC] = useState('');
  const [note, setNote] = useState('');
  const confirm = useConfirm();
  const toast = useToast();
  useEffect(() => { if (open) { setW(''); setC(''); setNote(''); } }, [open]);
  const save = async () => {
    const kg = w ? parseNum(w) : null;
    const cm = c ? parseNum(c) : null;
    if (kg == null && cm == null) { toast('Cargá peso o cintura.', 'error'); return; }
    if ((kg != null && (kg < 30 || kg > 300)) || (cm != null && (cm < 40 || cm > 250))) { toast('Revisá los valores (kg o cm).', 'error'); return; }
    const existing = (await byDate('body', date)).filter((b) => (kg != null && b.weightKg != null) || (cm != null && b.waistCm != null));
    if (existing.length) {
      const e = existing[existing.length - 1];
      const r = await confirm({
        title: 'Ya hay una medición este día',
        body: `${e.weightKg != null ? n1(e.weightKg) + ' kg' : ''} ${e.waistCm != null ? n1(e.waistCm) + ' cm' : ''}. ¿Reemplazarla o agregar otra?`,
        ok: 'Reemplazar', extra: [{ label: 'Agregar otra', value: 'add' }],
      });
      if (!r) return;
      if (r === 'ok') {
        await put('body', { ...e, weightKg: kg ?? e.weightKg, waistCm: cm ?? e.waistCm, note: note || e.note, at: Date.now() });
        onClose(); return;
      }
    }
    await put('body', { id: uid(), date, weightKg: kg, waistCm: cm, note, at: Date.now() });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Peso y cintura">
      <div className="row gap">
        <Field label="Peso (kg)"><input inputMode="decimal" placeholder="Ej.: 108,4" value={w} onChange={(e) => setW(e.target.value)} /></Field>
        <Field label="Cintura (cm)"><input inputMode="decimal" placeholder="Ej.: 104" value={c} onChange={(e) => setC(e.target.value)} /></Field>
      </div>
      <Field label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: en ayunas, después de ir al baño" /></Field>
      <button className="btn primary block" onClick={save}>Guardar</button>
      <p className="small muted">Conviene medir en condiciones parecidas (misma hora, antes de comer). Un día aislado varía por agua, sal y digestión: mirá el promedio semanal en Progreso.</p>
    </Sheet>
  );
}

// ---------------- Sueño ----------------
export function SleepSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DaySummary }) {
  const [h, setH] = useState('');
  const [note, setNote] = useState('');
  const toast = useToast();
  useEffect(() => { if (open) { setH(s.day.sleepHours != null ? String(s.day.sleepHours).replace('.', ',') : ''); setNote(s.day.sleepNote ?? ''); } }, [open, s.day.sleepHours, s.day.sleepNote]);
  const save = async () => {
    const v = h ? parseNum(h) : null;
    if (h && (v == null || v < 0 || v > 16)) { toast('Ingresá horas entre 0 y 16.', 'error'); return; }
    await patchDay(s.date, { sleepHours: v, sleepNote: note });
    onClose();
  };
  const imp = s.sleep.imported;
  return (
    <Sheet open={open} onClose={onClose} title="Sueño (noche anterior)">
      {imp ? (
        <p>Importado de {imp.sourceName}: {imp.asleepH != null ? `${n1(imp.asleepH)} h dormido` : 'sin etapas de sueño'}{imp.inBedH != null ? ` · ${n1(imp.inBedH)} h en cama` : ''} {sourceChip(imp.kind)}</p>
      ) : (
        <p className="muted small">{hasHealthBridge() ? 'Sin datos de sueño disponibles en Salud para este día.' : 'Registro manual (la importación requiere la versión iOS).'}</p>
      )}
      <Field label="Horas dormidas (manual)"><input inputMode="decimal" placeholder="Ej.: 7,5" value={h} onChange={(e) => setH(e.target.value)} /></Field>
      <Field label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: me desperté varias veces" /></Field>
      <button className="btn primary block" onClick={save}>Guardar</button>
    </Sheet>
  );
}
