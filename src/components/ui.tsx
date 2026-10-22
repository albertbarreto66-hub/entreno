import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
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
      {st && (
        <div className="sheet-backdrop center" onClick={() => done(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-label={st.title} onClick={(e) => e.stopPropagation()}>
            <h2>{st.title}</h2>
            {st.body && <div className="muted">{st.body}</div>}
            <div className="dialog-actions">
              {st.extra?.map((x) => <button key={x.value} className="btn secondary" onClick={() => done(x.value)}>{x.label}</button>)}
              <button className={`btn ${st.danger ? 'danger' : 'primary'}`} onClick={() => done('ok')}>{st.ok ?? 'Aceptar'}</button>
              <button className="btn ghost" onClick={() => done(false)}>{st.cancel ?? 'Cancelar'}</button>
            </div>
          </div>
        </div>
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

export function Check({ done, label, sub, onClick, na }: { done: boolean; label: string; sub?: ReactNode; onClick?: () => void; na?: boolean }) {
  return (
    <button className={`check ${done ? 'done' : ''} ${na ? 'na' : ''}`} onClick={onClick} aria-pressed={done} disabled={!onClick}>
      <span className="check-box" aria-hidden="true">{na ? '–' : done ? '✓' : ''}</span>
      <span className="check-text">
        <span className="check-label">{label}</span>
        {sub && <span className="check-sub">{sub}</span>}
      </span>
      <span className="check-state">{na ? 'No corresponde' : done ? 'Hecho' : 'Pendiente'}</span>
    </button>
  );
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
