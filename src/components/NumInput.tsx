import { useEffect, useRef, useState } from 'react';
import { parseNum } from '../lib/format';

/**
 * Campo numérico que mantiene el texto mientras escribís (para "42," → "42,5")
 * y avisa el valor parseado. Acepta coma o punto.
 */
export function NumInput({ value, onCommit, label, placeholder, integer, className, min = 0, max = 1000 }: {
  value: number | null; onCommit: (v: number | null) => void; label: string; placeholder?: string; integer?: boolean; className?: string; min?: number; max?: number;
}) {
  const fmt = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(fmt(value)); }, [value]);
  const commit = (t: string) => {
    if (t.trim() === '') { if (value !== null) onCommit(null); return; }
    const v = parseNum(t);
    if (v == null || v < min || v > max) return;
    const vv = integer ? Math.round(v) : v;
    if (vv !== value) onCommit(vv);
  };
  return (
    <input
      className={className} aria-label={label} placeholder={placeholder} value={text}
      inputMode={integer ? 'numeric' : 'decimal'}
      onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
      onChange={(e) => { setText(e.target.value); if (!/[.,]$/.test(e.target.value)) commit(e.target.value); }}
      onBlur={(e) => {
        focused.current = false;
        const t = e.target.value;
        commit(t);
        const v = parseNum(t);
        setText(t.trim() === '' ? '' : v != null && v >= min && v <= max ? fmt(integer ? Math.round(v) : v) : fmt(value));
      }}
    />
  );
}
