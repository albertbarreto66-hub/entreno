import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { onChange } from '../lib/db';

// ---------- Toast "Guardado" ----------
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error'; n: number } | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setMsg((m) => ({ text, kind, n: (m?.n ?? 0) + 1 }));
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), kind === 'error' ? 5000 : 1800);
  }, []);
  useEffect(() => onChange(({ quiet }) => { if (!quiet) show('Guardado ✓'); }), [show]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite" role="status">
        {msg && <div key={msg.n} className={`toast ${msg.kind}`}>{msg.text}</div>}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Hoja inferior (modal) ----------
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- Confirmación (promesa) ----------
interface ConfirmOpts { title: string; body?: ReactNode; ok?: string; cancel?: string; danger?: boolean; extra?: { label: string; value: string }[] }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<string | false>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<(ConfirmOpts & { resolve: (v: string | false) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<string | false>((resolve) => setSt({ ...o, resolve })), []);
  const done = (v: string | false) => { st?.resolve(v); setSt(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {st && createPortal(
        <div className="sheet-backdrop center confirm-layer" onClick={() => done(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-label={st.title} onClick={(e) => e.stopPropagation()}>
            <h2>{st.title}</h2>
            {st.body && <div className="muted">{st.body}</div>}
            <div className="dialog-actions">
              {st.extra?.map((x) => <button key={x.value} className="btn secondary" onClick={() => done(x.value)}>{x.label}</button>)}
              <button className={`btn ${st.danger ? 'danger' : 'primary'}`} onClick={() => done('ok')}>{st.ok ?? 'Aceptar'}</button>
              <button className="btn ghost" onClick={() => done(false)}>{st.cancel ?? 'Cancelar'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ConfirmCtx.Provider>
  );
}

// ---------- Campos ----------
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export type Tone = 'meal' | 'train' | 'steps' | 'water' | 'sleep' | 'weight' | 'brand';

export function Check({ done, label, sub, onClick, na, icon, tone = 'brand' }: {
  done: boolean; label: string; sub?: ReactNode; onClick?: () => void; na?: boolean; icon?: ReactNode; tone?: Tone;
}) {
  // Celebración breve solo cuando pasa de pendiente a hecho (no al cargar).
  const prev = useRef(done);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (done && !prev.current && ref.current) celebrate(ref.current);
    prev.current = done;
  }, [done]);
  return (
    <button ref={ref} className={`check t-${tone} ${done ? 'done' : ''} ${na ? 'na' : ''}`} onClick={onClick} aria-pressed={done} disabled={!onClick}>
      <span className="check-ic" aria-hidden="true">{icon}</span>
      <span className="check-text">
        <span className="check-label">{label}</span>
        {sub && <span className="check-sub">{sub}</span>}
      </span>
      <span className="check-state">{na ? 'No corresponde' : done ? 'Hecho' : 'Pendiente'}</span>
      <span className="check-box" aria-hidden="true">{na ? '–' : done ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="tick" d="m5 12.5 4.5 4.5L19 7.5" /></svg> : ''}</span>
    </button>
  );
}

/** Pequeña explosión de partículas sobre un elemento. Respeta "reducir movimiento". */
export function celebrate(el: Element) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'burst';
  layer.style.left = `${r.right - 34}px`;
  layer.style.top = `${r.top + r.height / 2}px`;
  const colors = ['var(--c-train)', 'var(--c-meal)', 'var(--c-water)', 'var(--c-steps)', 'var(--c-weight)'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('i');
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const d = 26 + Math.random() * 28;
    p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    p.style.background = colors[i % colors.length];
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  try { navigator.vibrate?.(12); } catch { /* sin vibración */ }
  setTimeout(() => layer.remove(), 800);
}

/** Número que sube suavemente hasta su valor. */
export function CountUp({ value, format = (v: number) => Math.round(v).toLocaleString('es-AR') }: { value: number; format?: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.current === value) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current, dur = 650;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="num">{format(shown)}</span>;
}

/** Ícono dentro de un círculo de color por categoría. */
export function IconBadge({ tone, children, size = 'md' }: { tone: Tone; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`ibadge t-${tone} ${size}`} aria-hidden="true">{children}</span>;
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'gray' }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
