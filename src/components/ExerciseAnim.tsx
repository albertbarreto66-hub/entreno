import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Figuras animadas propias (sin videos ni imágenes de terceros): un esqueleto paramétrico en SVG
 * que pasa de la posición inicial (A) a la final (B) con el ritmo de una repetición
 * (subida ~1 s, pausa, bajada ~2 s). El músculo que trabaja se resalta con el color de acento.
 *
 * Ángulos absolutos en grados: 0 = hacia abajo, 90 = hacia adelante (la figura mira a la derecha),
 * 180 = hacia arriba, −90 = hacia atrás. En vista frontal, positivo = hacia afuera.
 */

type Muscle = 'chest' | 'abs' | 'back' | 'delts' | 'rear' | 'biceps' | 'triceps' | 'forearm' | 'quads' | 'hams' | 'glutes' | 'calves';
type Grip = 'none' | 'handle' | 'dumbbell' | 'bar' | 'rope';

interface Pose {
  x: number; y: number; t: number;
  ua: number; fa: number; th: number; sh: number; ft?: number;
  ua2?: number; fa2?: number; th2?: number; sh2?: number;
}
interface Lens { torso: number; ua: number; fa: number; th: number; sh: number; foot: number }
type V = [number, number];
interface Geo {
  view: 'side' | 'front';
  H: V; N: V; head: V; S: V; E: V; W: V; K: V; A: V; T: V;
  E2: V; W2: V; K2: V; A2: V; T2: V;
  // vista frontal: lado izquierdo (espejo)
  SL: V; EL: V; WL: V; HR: V; HL: V; KL: V; AL: V; TL: V;
  d: V; n: V; pose: Pose;
}

export interface Pattern {
  view: 'side' | 'front';
  a: Pose; b: Pose;
  lens?: Partial<Lens>;
  hl: Muscle[];
  grip?: Grip;
  /** props dibujados detrás de la figura */
  back?: (g: Geo) => ReactNode;
  /** props dibujados delante */
  front?: (g: Geo) => ReactNode;
  loop?: 'rep' | 'walk' | 'breathe';
}

const BASE: Lens = { torso: 46, ua: 25, fa: 23, th: 36, sh: 36, foot: 11 };
const GROUND = 150;
const STAND = 75;
const SEAT = 111;

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number, len: number): V => [Math.sin(rad(deg)) * len, Math.cos(rad(deg)) * len];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function geometry(p: Pose, view: 'side' | 'front', L: Lens): Geo {
  if (view === 'side') {
    const H: V = [p.x, p.y];
    const d = dir(p.t, 1);
    const n: V = [-d[1], d[0]];
    const N = add(H, mul(d, L.torso));
    const head = add(N, mul(d, 14));
    const S = add(H, mul(d, L.torso - 5));
    const E = add(S, dir(p.ua, L.ua));
    const W = add(E, dir(p.fa, L.fa));
    const K = add(H, dir(p.th, L.th));
    const A = add(K, dir(p.sh, L.sh));
    const T = add(A, dir(p.ft ?? 90, L.foot));
    const off: V = [-3, -1.5];
    const E2 = add(add(S, off), dir(p.ua2 ?? p.ua, L.ua));
    const W2 = add(E2, dir(p.fa2 ?? p.fa, L.fa));
    const K2 = add(add(H, off), dir(p.th2 ?? p.th, L.th));
    const A2 = add(K2, dir(p.sh2 ?? p.sh, L.sh));
    const T2 = add(A2, dir(p.ft ?? 90, L.foot));
    return { view, H, N, head, S, E, W, K, A, T, E2, W2, K2, A2, T2, SL: S, EL: E, WL: W, HR: H, HL: H, KL: K, AL: A, TL: T, d, n, pose: p };
  }
  // Frontal: torso vertical; el ángulo positivo abre hacia afuera (derecha de la imagen para el lado R).
  const H: V = [p.x, p.y];
  const N: V = [p.x, p.y - L.torso];
  const head: V = [p.x, p.y - L.torso - 14];
  const S: V = [p.x + 17, p.y - L.torso + 7];
  const SL: V = [p.x - 17, S[1]];
  const mir = (v: V): V => [-v[0], v[1]];
  const E = add(S, dir(p.ua, L.ua)), W = add(E, dir(p.fa, L.fa));
  const EL = add(SL, mir(dir(p.ua, L.ua))), WL = add(EL, mir(dir(p.fa, L.fa)));
  const HR: V = [p.x + 9, p.y], HL: V = [p.x - 9, p.y];
  const K = add(HR, dir(p.th, L.th)), A = add(K, dir(p.sh, L.sh));
  const KL = add(HL, mir(dir(p.th, L.th))), AL = add(KL, mir(dir(p.sh, L.sh)));
  const T: V = [A[0] + 5, A[1] + 1], TL: V = [AL[0] - 5, AL[1] + 1];
  return { view, H, N, head, S, E, W, K, A, T, E2: E, W2: W, K2: K, A2: A, T2: T, SL, EL, WL, HR, HL, KL, AL, TL, d: [0, -1], n: [1, 0], pose: p };
}

function mix(a: Pose, b: Pose, k: number): Pose {
  const o: Record<string, number> = {};
  for (const key of Object.keys(a) as (keyof Pose)[]) {
    const va = a[key], vb = b[key] ?? va;
    if (va != null && vb != null) o[key] = lerp(va, vb, k);
  }
  for (const key of Object.keys(b) as (keyof Pose)[]) if (o[key] == null && b[key] != null) o[key] = b[key]!;
  return o as unknown as Pose;
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Progreso A→B de una repetición: sube 1,3 s, pausa, baja 2,2 s (controlado), pausa. */
export function repPhase(ms: number, loop: Pattern['loop'] = 'rep') {
  if (loop === 'walk') return (Math.sin((ms / 1000) * Math.PI * 1.6) + 1) / 2;
  if (loop === 'breathe') return (Math.sin((ms / 1000) * Math.PI * 0.5) + 1) / 2;
  const T = 4600, x = ms % T;
  if (x < 1300) return ease(x / 1300);
  if (x < 1800) return 1;
  if (x < 4000) return 1 - ease((x - 1800) / 2200);
  return 0;
}

// ---------- dibujo ----------
const seg = (a: V, b: V, w: number, cls: string, key?: string) => (
  <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} className={cls} strokeLinecap="round" />
);
const P = {
  line: (a: V, b: V, w = 4, cls = 'fx-prop') => seg(a, b, w, cls),
  cable: (a: V, b: V) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="fx-cable" />,
  dot: (c: V, r = 4, cls = 'fx-prop-fill') => <circle cx={c[0]} cy={c[1]} r={r} className={cls} />,
  seat: (x1: number, x2: number, y: number) => <>{seg([x1, y], [x2, y], 6, 'fx-prop')}{seg([(x1 + x2) / 2, y], [(x1 + x2) / 2, GROUND], 4, 'fx-prop')}</>,
  /** respaldo paralelo al torso, detrás */
  backrest: (g: Geo, from = -4, to = 52, gap = 10) => {
    const o = mul(g.n, -gap);
    return seg(add(add(g.H, o), mul(g.d, from)), add(add(g.H, o), mul(g.d, to)), 6, 'fx-prop');
  },
  /** almohadilla delante del pecho */
  chestpad: (g: Geo, from = 18, to = 42, gap = 10) => {
    const o = mul(g.n, gap);
    return seg(add(add(g.H, o), mul(g.d, from)), add(add(g.H, o), mul(g.d, to)), 6, 'fx-prop');
  },
};

function gripAt(grip: Grip | undefined, w: V, fa: number) {
  if (!grip || grip === 'none') return null;
  if (grip === 'dumbbell') return <g className="fx-weight"><circle cx={w[0]} cy={w[1]} r={5.5} /><circle cx={w[0]} cy={w[1]} r={2} className="fx-hole" /></g>;
  if (grip === 'handle') return <circle cx={w[0]} cy={w[1]} r={3.6} className="fx-prop-fill" />;
  if (grip === 'rope') { const e = add(w, dir(fa, 6)); return seg(w, e, 3, 'fx-prop'); }
  const p = dir(fa + 90, 8);
  return seg(add(w, mul(p, -1)), add(w, p), 3.4, 'fx-prop');
}

const floor = (x1 = 18, x2 = 182) => <line x1={x1} y1={GROUND + 3} x2={x2} y2={GROUND + 3} className="fx-floor" />;

// ---------- patrones ----------
const seatedLegs = { th: 90, sh: 0 };
export const PATTERNS: Record<string, Pattern> = {
  'press-incline': {
    view: 'side', hl: ['chest', 'delts', 'triceps'], grip: 'handle',
    a: { x: 92, y: SEAT, t: 215, ua: -30, fa: 125, ...seatedLegs },
    b: { x: 92, y: SEAT, t: 215, ua: 125, fa: 125, ...seatedLegs },
    back: (g) => <>{P.seat(74, 112, SEAT + 7)}{P.backrest(g, -2, 56)}</>,
  },
  'press-flat': {
    view: 'side', hl: ['chest', 'triceps'], grip: 'handle',
    a: { x: 88, y: SEAT, t: 185, ua: -50, fa: 95, ...seatedLegs },
    b: { x: 88, y: SEAT, t: 185, ua: 95, fa: 93, ...seatedLegs },
    back: (g) => <>{P.seat(70, 108, SEAT + 7)}{P.backrest(g, 0, 50)}</>,
  },
  pulldown: {
    view: 'side', hl: ['back', 'biceps'], grip: 'bar',
    a: { x: 92, y: SEAT, t: 195, ua: 165, fa: 172, ...seatedLegs },
    b: { x: 92, y: SEAT, t: 195, ua: -25, fa: 150, ...seatedLegs },
    back: (g) => <>{P.seat(74, 112, SEAT + 7)}{P.cable([g.W[0] + 2, -12], g.W)}{P.line([118, SEAT - 10], [132, SEAT - 10], 7)}</>,
  },
  'row-seated': {
    view: 'side', hl: ['back', 'rear', 'biceps'], grip: 'handle',
    a: { x: 66, y: SEAT, t: 158, ua: 80, fa: 82, th: 75, sh: 62 },
    b: { x: 66, y: SEAT, t: 184, ua: -42, fa: 88, th: 75, sh: 62 },
    back: (g) => <>{P.seat(44, 92, SEAT + 7)}{P.line([g.A[0] + 8, g.A[1] - 20], [g.A[0] + 8, GROUND], 5)}{P.cable([190, 102], g.W)}{P.line([190, 96], [190, GROUND], 5)}</>,
  },
  'row-chest': {
    view: 'side', hl: ['back', 'rear', 'biceps'], grip: 'handle',
    a: { x: 82, y: SEAT, t: 166, ua: 72, fa: 76, ...seatedLegs },
    b: { x: 82, y: SEAT, t: 166, ua: -52, fa: 82, ...seatedLegs },
    back: (g) => <>{P.seat(64, 100, SEAT + 7)}{P.chestpad(g, 16, 44, 12)}{P.line([140, 60], [140, GROUND], 5)}</>,
  },
  pushdown: {
    view: 'side', hl: ['triceps'], grip: 'rope',
    a: { x: 92, y: STAND, t: 172, ua: -6, fa: 150, th: 4, sh: -3, th2: -6, sh2: -4 },
    b: { x: 92, y: STAND, t: 172, ua: -6, fa: 4, th: 4, sh: -3, th2: -6, sh2: -4 },
    back: (g) => <>{P.line([140, -12], [140, GROUND], 5)}{P.cable([138, -2], g.W)}</>,
  },
  'overhead-ext': {
    view: 'side', hl: ['triceps'], grip: 'rope',
    a: { x: 96, y: STAND + 2, t: 158, ua: 162, fa: -25, th: 20, sh: 2, th2: -18, sh2: -12 },
    b: { x: 96, y: STAND + 2, t: 158, ua: 156, fa: 150, th: 20, sh: 2, th2: -18, sh2: -12 },
    back: (g) => <>{P.line([22, 60], [22, GROUND], 5)}{P.cable([24, 70], g.W)}</>,
  },
  'curl-incline': {
    view: 'side', hl: ['biceps'], grip: 'dumbbell',
    a: { x: 92, y: SEAT, t: 215, ua: -4, fa: -4, ...seatedLegs },
    b: { x: 92, y: SEAT, t: 215, ua: -4, fa: 140, ...seatedLegs },
    back: (g) => <>{P.seat(74, 112, SEAT + 7)}{P.backrest(g, -2, 56)}</>,
  },
  'curl-hammer': {
    view: 'side', hl: ['biceps', 'forearm'], grip: 'dumbbell',
    a: { x: 96, y: STAND, t: 180, ua: 2, fa: 2, th: 3, sh: -2, th2: -3, sh2: -2 },
    b: { x: 96, y: STAND, t: 180, ua: 2, fa: 148, th: 3, sh: -2, th2: -3, sh2: -2 },
  },
  'face-pull': {
    view: 'side', hl: ['rear', 'back'], grip: 'rope',
    a: { x: 86, y: STAND, t: 186, ua: 100, fa: 96, th: 14, sh: 0, th2: -12, sh2: -8 },
    b: { x: 86, y: STAND, t: 186, ua: -96, fa: 150, th: 14, sh: 0, th2: -12, sh2: -8 },
    back: (g) => <>{P.line([192, -12], [192, GROUND], 5)}{P.cable([190, 26], g.W)}</>,
  },
  'cable-fly-up': {
    view: 'side', hl: ['chest', 'delts'], grip: 'handle',
    a: { x: 100, y: STAND, t: 176, ua: -18, fa: -8, th: 12, sh: 0, th2: -10, sh2: -6 },
    b: { x: 100, y: STAND, t: 176, ua: 128, fa: 134, th: 12, sh: 0, th2: -10, sh2: -6 },
    back: (g) => <>{P.line([30, 100], [30, GROUND], 5)}{P.cable([32, 144], g.W)}</>,
  },
  'leg-press': {
    view: 'side', hl: ['quads', 'glutes'],
    a: { x: 62, y: 116, t: 238, ua: 25, fa: 70, th: 162, sh: 76, ft: 35 },
    b: { x: 62, y: 116, t: 238, ua: 25, fa: 70, th: 124, sh: 124, ft: 35 },
    back: (g) => {
      const u = dir(35, 16);
      return <>{P.backrest(g, -6, 50, 9)}{P.line([40, 124], [92, 124], 6)}{P.line([66, 124], [66, GROUND], 4)}{seg(add(g.A, mul(u, -1)), add(g.A, u), 6, 'fx-prop')}{P.line([136, 110], [176, 50], 3, 'fx-rail')}</>;
    },
  },
  'leg-press-high': {
    view: 'side', hl: ['glutes', 'hams'],
    a: { x: 62, y: 116, t: 238, ua: 25, fa: 70, th: 166, sh: 82, ft: 35 },
    b: { x: 62, y: 116, t: 238, ua: 25, fa: 70, th: 128, sh: 120, ft: 35 },
    back: (g) => {
      const u = dir(35, 18);
      return <>{P.backrest(g, -6, 50, 9)}{P.line([40, 124], [92, 124], 6)}{P.line([66, 124], [66, GROUND], 4)}{seg(add(g.A, mul(u, -0.6)), add(g.A, mul(u, 1.4)), 6, 'fx-prop')}{P.line([136, 110], [176, 50], 3, 'fx-rail')}</>;
    },
  },
  'hip-thrust': {
    view: 'side', hl: ['glutes', 'hams'],
    a: { x: 96, y: 128, t: 242, ua: 70, fa: 20, th: 110, sh: 4 },
    b: { x: 100, y: 104, t: 268, ua: 70, fa: 20, th: 75, sh: -5 },
    back: () => <>{P.line([22, 116], [62, 116], 8)}{P.line([30, 116], [30, GROUND], 4)}{P.line([56, 116], [56, GROUND], 4)}</>,
    front: (g) => P.dot(add(g.H, mul(g.n, 9)), 6, 'fx-pad'),
  },
  'leg-ext': {
    view: 'side', hl: ['quads'],
    a: { x: 86, y: SEAT, t: 190, ua: 20, fa: 30, th: 90, sh: 6 },
    b: { x: 86, y: SEAT, t: 190, ua: 20, fa: 30, th: 90, sh: 84 },
    back: (g) => <>{P.seat(66, 124, SEAT + 7)}{P.backrest(g, 0, 44)}</>,
    front: (g) => P.dot(add(g.A, dir(g.pose.sh + 90, 6)), 5, 'fx-pad'),
  },
  'leg-curl-seated': {
    view: 'side', hl: ['hams'],
    a: { x: 86, y: SEAT, t: 192, ua: 20, fa: 30, th: 88, sh: 80 },
    b: { x: 86, y: SEAT, t: 192, ua: 20, fa: 30, th: 88, sh: -22 },
    back: (g) => <>{P.seat(66, 124, SEAT + 7)}{P.backrest(g, 0, 44)}</>,
    front: (g) => <>{P.dot(add(g.K, [-6, -8]), 5, 'fx-pad')}{P.dot(add(g.A, dir(g.pose.sh - 90, 6)), 5, 'fx-pad')}</>,
  },
  'leg-curl-lying': {
    view: 'side', hl: ['hams'],
    a: { x: 98, y: 112, t: 271, ua: -8, fa: -70, th: 91, sh: 91, ft: 0 },
    b: { x: 98, y: 112, t: 271, ua: -8, fa: -70, th: 91, sh: 200, ft: 110 },
    back: () => <>{P.line([30, 121], [150, 121], 6)}{P.line([44, 121], [44, GROUND], 4)}{P.line([136, 121], [136, GROUND], 4)}</>,
    front: (g) => P.dot(add(g.A, dir(g.pose.sh + 90, 6)), 5, 'fx-pad'),
  },
  'calf-seated': {
    view: 'side', hl: ['calves'],
    a: { x: 86, y: SEAT, t: 182, ua: 25, fa: 85, th: 90, sh: 0, ft: 116 },
    b: { x: 86, y: SEAT - 7, t: 182, ua: 25, fa: 85, th: 90, sh: 0, ft: 58 },
    back: () => <>{P.seat(64, 104, SEAT + 7)}{P.line([128, 147], [146, 147], 6)}</>,
    front: (g) => P.dot(add(g.K, [0, -7]), 5, 'fx-pad'),
  },
  rdl: {
    view: 'side', hl: ['hams', 'glutes'], grip: 'dumbbell',
    a: { x: 89, y: STAND, t: 180, ua: 0, fa: 0, th: 2, sh: -2 },
    b: { x: 82, y: 82, t: 104, ua: 2, fa: 0, th: 13, sh: -7 },
  },
  'leg-raise': {
    view: 'side', hl: ['abs'],
    a: { x: 98, y: 82, t: 180, ua: 2, fa: 90, th: 0, sh: 0 },
    b: { x: 98, y: 82, t: 180, ua: 2, fa: 90, th: 96, sh: 22 },
    back: (g) => <>{P.backrest(g, 4, 52, 10)}{P.line([g.E[0] - 2, g.E[1] + 5], [g.E[0] + 24, g.E[1] + 5], 6)}{P.line([76, 40], [76, GROUND], 4)}</>,
  },
  crunch: {
    view: 'side', hl: ['abs'], grip: 'rope',
    a: { x: 104, y: 110, t: 176, ua: 168, fa: -18, th: 0, sh: -88, ft: 180 },
    b: { x: 104, y: 110, t: 112, ua: 104, fa: -82, th: 0, sh: -88, ft: 180 },
    back: (g) => <>{P.line([150, -12], [150, GROUND], 5)}{P.cable([148, -4], g.W)}</>,
  },
  'lateral-db': {
    view: 'front', hl: ['delts'], grip: 'dumbbell',
    a: { x: 100, y: STAND, t: 180, ua: 8, fa: 6, th: 4, sh: 0 },
    b: { x: 100, y: STAND, t: 180, ua: 86, fa: 80, th: 4, sh: 0 },
  },
  'lateral-cable': {
    view: 'front', hl: ['delts'], grip: 'handle',
    a: { x: 100, y: STAND, t: 180, ua: 8, fa: 6, th: 4, sh: 0 },
    b: { x: 100, y: STAND, t: 180, ua: 86, fa: 80, th: 4, sh: 0 },
    back: (g) => <>{P.cable([84, 146], g.W)}{P.cable([116, 146], g.WL)}</>,
  },
  'lateral-machine': {
    view: 'front', hl: ['delts'], lens: { th: 16, sh: 32 },
    a: { x: 100, y: 102, t: 180, ua: 10, fa: 30, th: 14, sh: 2 },
    b: { x: 100, y: 102, t: 180, ua: 84, fa: 110, th: 14, sh: 2 },
    back: () => P.line([80, 108], [120, 108], 7),
    front: (g) => <>{P.dot(add(g.E, [0, -4]), 4.5, 'fx-pad')}{P.dot(add(g.EL, [0, -4]), 4.5, 'fx-pad')}</>,
  },
  'shoulder-press': {
    view: 'front', hl: ['delts', 'triceps'], grip: 'handle', lens: { th: 16, sh: 32 },
    a: { x: 100, y: 102, t: 180, ua: 98, fa: 178, th: 14, sh: 2 },
    b: { x: 100, y: 102, t: 180, ua: 158, fa: 174, th: 14, sh: 2 },
    back: () => P.line([80, 108], [120, 108], 7),
  },
  abduction: {
    view: 'front', hl: ['glutes'], lens: { th: 18, sh: 32 },
    a: { x: 100, y: 100, t: 180, ua: 22, fa: 6, th: 8, sh: 2 },
    b: { x: 100, y: 100, t: 180, ua: 22, fa: 6, th: 42, sh: 10 },
    back: () => P.line([78, 106], [122, 106], 7),
    front: (g) => <>{P.dot(add(g.K, [4, 0]), 4.5, 'fx-pad')}{P.dot(add(g.KL, [-4, 0]), 4.5, 'fx-pad')}</>,
  },
  walk: {
    view: 'side', hl: [], loop: 'walk',
    a: { x: 100, y: STAND + 1, t: 176, ua: -22, fa: -6, ua2: 22, fa2: 40, th: 22, sh: -2, th2: -20, sh2: -28 },
    b: { x: 100, y: STAND + 1, t: 176, ua: 22, fa: 40, ua2: -22, fa2: -6, th: -20, sh: -28, th2: 22, sh2: -2 },
  },
  idle: {
    view: 'front', hl: [], loop: 'breathe',
    a: { x: 100, y: STAND, t: 180, ua: 10, fa: 6, th: 4, sh: 0 },
    b: { x: 100, y: STAND - 1, t: 180, ua: 12, fa: 8, th: 4, sh: 0 },
  },
};

/** Animación según el ejercicio: primero por id, después por nombre (plantillas editadas). */
const BY_ID: Record<string, string | [string, Grip]> = {
  'l-press-inclinado-maq': 'press-incline', 'l-jalon-ancho': 'pulldown', 'l-press-plano-maq': 'press-flat', 'l-remo-sentado': 'row-seated',
  'l-laterales-polea': 'lateral-cable', 'l-triceps-cuerda': 'pushdown',
  'm-prensa': 'leg-press', 'm-hip-thrust': 'hip-thrust', 'm-extension-cuad': 'leg-ext', 'm-femoral-sentado': 'leg-curl-seated', 'm-gemelos': 'calf-seated', 'm-elevacion-piernas': 'leg-raise',
  'x-jalon-neutro': 'pulldown', 'x-remo-apoyado': 'row-chest', 'x-press-hombro': 'shoulder-press', 'x-laterales-manc': 'lateral-db', 'x-face-pull': 'face-pull', 'x-curl-inclinado': 'curl-incline',
  'j-rumano': 'rdl', 'j-prensa-alta': 'leg-press-high', 'j-femoral-acostado': 'leg-curl-lying', 'j-abduccion': 'abduction', 'j-extension-cuad': 'leg-ext', 'j-crunch-polea': 'crunch',
  'v-press-inclinado-manc': ['press-incline', 'dumbbell'], 'v-remo-maq-ancho': 'row-chest', 'v-laterales-maq': 'lateral-machine', 'v-cruce-bajo-alto': 'cable-fly-up',
  'v-curl-martillo': 'curl-hammer', 'v-triceps-cabeza': 'overhead-ext',
};
const BY_NAME: [RegExp, string][] = [
  [/jal[oó]n|dominada/i, 'pulldown'], [/press.*(hombro|militar)/i, 'shoulder-press'], [/press.*inclin/i, 'press-incline'], [/press|pec deck|fondos/i, 'press-flat'],
  [/remo.*(apoy|m[aá]quina)/i, 'row-chest'], [/remo/i, 'row-seated'], [/lateral.*m[aá]quina/i, 'lateral-machine'], [/lateral.*polea/i, 'lateral-cable'], [/lateral/i, 'lateral-db'],
  [/tr[ií]ceps.*(cabeza|franc)/i, 'overhead-ext'], [/tr[ií]ceps/i, 'pushdown'], [/femoral.*acost/i, 'leg-curl-lying'], [/femoral/i, 'leg-curl-seated'],
  [/curl.*inclin/i, 'curl-incline'], [/curl/i, 'curl-hammer'], [/prensa.*alt/i, 'leg-press-high'], [/prensa|sentadilla|hack/i, 'leg-press'], [/hip thrust|puente/i, 'hip-thrust'],
  [/extensi[oó]n.*cu[aá]d/i, 'leg-ext'], [/gemelo|pantorr/i, 'calf-seated'], [/elevaci[oó]n de piernas|crunch inverso/i, 'leg-raise'], [/crunch|abdom/i, 'crunch'],
  [/rumano|peso muerto|hiperext/i, 'rdl'], [/abducci/i, 'abduction'], [/face pull|p[aá]jaro|posterior/i, 'face-pull'], [/cruce|apertura|fly/i, 'cable-fly-up'],
  [/camin/i, 'walk'],
];

export function animFor(ex: { id?: string; exerciseId?: string; name: string }): Pattern {
  const id = ex.id ?? ex.exerciseId ?? '';
  const hit = BY_ID[id];
  if (hit) {
    const [k, grip] = Array.isArray(hit) ? hit : [hit, undefined];
    const p = PATTERNS[k];
    return grip ? { ...p, grip } : p;
  }
  const byName = BY_NAME.find(([re]) => re.test(ex.name));
  const p = PATTERNS[byName?.[1] ?? 'idle'];
  if (/mancuerna/i.test(ex.name) && p.grip && p.grip !== 'none') return { ...p, grip: 'dumbbell' };
  return p;
}

// ---------- reloj compartido ----------
const subs = new Set<(ms: number) => void>();
let raf = 0;
const t0 = performance.now();
function tick(now: number) {
  for (const f of subs) f(now - t0);
  raf = subs.size ? requestAnimationFrame(tick) : 0;
}
function subscribe(f: (ms: number) => void) {
  subs.add(f);
  if (!raf) raf = requestAnimationFrame(tick);
  return () => { subs.delete(f); };
}
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- cuerpo anatómico ----------
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const len = (a: V) => Math.hypot(a[0], a[1]) || 1;
const unit = (a: V): V => mul(a, 1 / len(a));
const f1 = (v: number) => Math.round(v * 10) / 10;

/** Curva cerrada suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
function spline(pts: V[]) {
  const n = pts.length;
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6)), c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + 'Z';
}

/** Perfil de un músculo/segmento: radio en cada punta y vientre muscular a cada lado. */
interface Prof { r1: number; r2: number; nb: number; mb: number; at: number }
const PROF = {
  upperArm: { r1: 6.4, r2: 4.1, nb: 6.6, mb: 6.2, at: 0.42 },
  forearm: { r1: 4.6, r2: 2.9, nb: 5.0, mb: 4.4, at: 0.28 },
  thigh: { r1: 10, r2: 5.8, nb: 9.2, mb: 10.4, at: 0.38 },
  shin: { r1: 5.4, r2: 3.2, nb: 7.4, mb: 4.8, at: 0.3 },
} satisfies Record<string, Prof>;

function limbPath(a: V, b: V, p: Prof, flip = false) {
  const d = unit(sub(b, a)), L = len(sub(b, a));
  let n: V = [-d[1], d[0]];
  if (flip) n = mul(n, -1);
  const at = (t: number) => add(a, mul(d, L * t));
  return spline([
    add(a, mul(d, -p.r1 * 0.75)),
    add(a, mul(n, p.r1)),
    add(at(p.at), mul(n, p.nb)),
    add(at(0.82), mul(n, p.r2 * 1.15)),
    add(b, mul(n, p.r2 * 0.9)),
    add(b, mul(d, p.r2 * 0.8)),
    add(b, mul(n, -p.r2 * 0.9)),
    add(at(0.82), mul(n, -p.r2 * 1.15)),
    add(at(p.at), mul(n, -p.mb)),
    add(a, mul(n, -p.r1)),
  ]);
}

function footPath(A: V, T: V, flip = false) {
  const d = unit(sub(T, A));
  let n: V = [-d[1], d[0]];
  if (flip) n = mul(n, -1);
  // n apunta hacia la planta cuando el pie está apoyado
  return spline([add(A, mul(n, -3)), add(A, mul(d, -3.5)), add(add(A, mul(d, -2)), mul(n, 3)), add(T, mul(n, 2)), add(T, mul(d, 2)), add(add(T, mul(d, -2)), mul(n, -1.5))]);
}

export interface Look { skin: string; far: string; hl: string; hlFar: string }

function Figure({ g, hl, grip, ids }: { g: Geo; hl: Set<Muscle>; grip?: Grip; ids: Look }) {
  const p = g.pose;
  const body = (m?: Muscle | false) => (m && hl.has(m) ? `url(#${ids.hl})` : `url(#${ids.skin})`);
  const far = (m?: Muscle | false) => (m && hl.has(m) ? `url(#${ids.hlFar})` : `url(#${ids.far})`);
  const armM: Muscle | false = hl.has('biceps') ? 'biceps' : hl.has('triceps') ? 'triceps' : false;
  const thighM: Muscle = hl.has('quads') ? 'quads' : 'hams';
  const shape = (d: string, fill: string, key?: string) => <path key={key} d={d} fill={fill} className="fx-shape" />;

  if (g.view === 'front') {
    const cx = g.H[0], top = g.N[1];
    const sym = (pts: V[]) => [...pts.map(([x, y]) => [cx + x, top + y] as V), ...[...pts].reverse().map(([x, y]) => [cx - x, top + y] as V)];
    const torso = spline(sym([[4, -3], [9, 1], [21, 7], [20, 18], [18.5, 26], [13, 38], [13.5, 46], [9, 52], [2, 54]]));
    const pecs = (s: number) => spline([[cx + s * 1.5, top + 8], [cx + s * 15, top + 8], [cx + s * 17, top + 15], [cx + s * 10, top + 21], [cx + s * 2, top + 19]] as V[]);
    const absD = spline([[cx - 7, top + 22], [cx + 7, top + 22], [cx + 7.5, top + 40], [cx, top + 47], [cx - 7.5, top + 40]] as V[]);
    const hip = (s: number) => spline([[cx + s * 9, top + 38], [cx + s * 15, top + 42], [cx + s * 15, top + 50], [cx + s * 9, top + 50]] as V[]);
    const S = [cx + 17, g.S[1]] as V, SL = [cx - 17, g.S[1]] as V;
    const E = add(S, sub(g.E, g.S)), W = add(S, sub(g.W, g.S)), EL = add(SL, sub(g.EL, g.SL)), WL = add(SL, sub(g.WL, g.SL));
    const delt = (c: V, s: number) => spline([add(c, [s * -6, -4]), add(c, [s * 2, -6.5]), add(c, [s * 7.5, -1]), add(c, [s * 6, 7]), add(c, [s * -1, 6])]);
    return (
      <g>
        {shape(limbPath(g.HR, g.K, PROF.thigh), body(thighM))}{shape(limbPath(g.K, g.A, PROF.shin), body(hl.has('calves') && 'calves'))}
        {shape(limbPath(g.HL, g.KL, PROF.thigh, true), body(thighM))}{shape(limbPath(g.KL, g.AL, PROF.shin, true), body(hl.has('calves') && 'calves'))}
        {shape(footPath(g.A, g.T), body())}{shape(footPath(g.AL, g.TL, true), body())}
        {shape(torso, body())}
        <path d={`M${cx},${top + 20} L${cx},${top + 44} M${cx - 7},${top + 28} L${cx + 7},${top + 28} M${cx - 7},${top + 34} L${cx + 7},${top + 34}`} className="fx-detail" />
        {shape(pecs(1), body(hl.has('chest') && 'chest'))}{shape(pecs(-1), body(hl.has('chest') && 'chest'))}
        {hl.has('abs') && shape(absD, `url(#${ids.hl})`)}
        {hl.has('glutes') && <>{shape(hip(1), `url(#${ids.hl})`)}{shape(hip(-1), `url(#${ids.hl})`)}</>}
        {shape(spline([[cx - 4.5, top + 2], [cx - 4, top - 8], [cx + 4, top - 8], [cx + 4.5, top + 2]] as V[]), body())}
        <ellipse cx={g.head[0]} cy={g.head[1] + 1} rx={7.6} ry={9.2} fill={`url(#${ids.skin})`} className="fx-shape" />
        {shape(limbPath(S, E, PROF.upperArm), body(armM))}{shape(limbPath(E, W, PROF.forearm), body(hl.has('forearm') && 'forearm'))}
        {shape(limbPath(SL, EL, PROF.upperArm, true), body(armM))}{shape(limbPath(EL, WL, PROF.forearm, true), body(hl.has('forearm') && 'forearm'))}
        {shape(delt(S, 1), body(hl.has('delts') && 'delts'))}{shape(delt(SL, -1), body(hl.has('delts') && 'delts'))}
        {gripAt(grip, W, p.fa)}{gripAt(grip, WL, -p.fa)}
      </g>
    );
  }

  // Lateral: f(u, v) = punto a u unidades por el tronco (desde la cadera) y v hacia el frente (+) o la espalda (−)
  const f = (u: number, v: number) => add(add(g.H, mul(g.d, u)), mul(g.n, v));
  const torso = spline([f(-5, -3), f(1, -10.5), f(9, -10), f(17, -6.5), f(28, -9), f(38, -10), f(45, -6), f(47.5, 1), f(43, 8.5), f(36, 11), f(29, 8.5), f(18, 8.5), f(7, 9), f(-2, 6.5)]);
  const chest = spline([f(44, 4), f(41.5, 10), f(35, 11.6), f(29.5, 8.4), f(32, 3.5), f(39, 2.5)]);
  const abs = spline([f(28.5, 8.6), f(18, 9.2), f(7, 9.6), f(5, 5.5), f(16, 5), f(27, 5)]);
  const lats = spline([f(41, -9.2), f(30, -10), f(18, -7.6), f(21, -3.5), f(31, -4), f(39, -5)]);
  const glute = spline([f(8, -9.8), f(1, -10.8), f(-4, -5), f(0, -2), f(6, -4.5)]);
  const cap = (c: V, back = 0) => {
    const o = add(c, mul(g.n, back));
    return spline([add(o, mul(g.d, 6.5)), add(o, mul(g.n, 7)), add(add(o, mul(g.d, -7)), mul(g.n, 2)), add(add(o, mul(g.d, -6)), mul(g.n, -5)), add(o, mul(g.n, -6.5))]);
  };
  const neckBase = f(46, 0), headC = g.head;
  const nd = unit(sub(headC, neckBase)), nn: V = [-nd[1], nd[0]];
  const neck = spline([add(neckBase, mul(nn, 4.5)), add(add(neckBase, mul(nd, 9)), mul(nn, 3.5)), add(add(neckBase, mul(nd, 9)), mul(nn, -4)), add(neckBase, mul(nn, -5.5))]);
  const faceAng = (Math.atan2(g.n[1], g.n[0]) * 180) / Math.PI;
  const S2 = add(g.S, [-3, -1.5]), H2 = add(g.H, [-3, -1.5]);
  return (
    <g>
      {/* extremidades lejanas, más oscuras */}
      {shape(limbPath(H2, g.K2, PROF.thigh), far(thighM))}{shape(limbPath(g.K2, g.A2, PROF.shin), far(hl.has('calves') && 'calves'))}{shape(footPath(g.A2, g.T2), far())}
      {shape(limbPath(S2, g.E2, PROF.upperArm), far(armM))}{shape(limbPath(g.E2, g.W2, PROF.forearm), far(hl.has('forearm') && 'forearm'))}
      {gripAt(grip, g.W2, p.fa2 ?? p.fa)}
      {/* tronco y cabeza */}
      {shape(neck, body())}
      <ellipse cx={headC[0]} cy={headC[1]} rx={8} ry={9.4} transform={`rotate(${faceAng - 90} ${headC[0]} ${headC[1]})`} fill={`url(#${ids.skin})`} className="fx-shape" />
      {shape(spline([add(headC, add(mul(g.n, 6.8), mul(g.d, 2))), add(headC, add(mul(g.n, 10), mul(g.d, -1))), add(headC, add(mul(g.n, 7), mul(g.d, -3)))]), `url(#${ids.skin})`)}
      {shape(torso, body())}
      {shape(chest, body(hl.has('chest') && 'chest'))}
      {shape(abs, body(hl.has('abs') && 'abs'))}
      {hl.has('back') && shape(lats, `url(#${ids.hl})`)}
      {shape(glute, body(hl.has('glutes') && 'glutes'))}
      {/* extremidades cercanas */}
      {shape(limbPath(g.H, g.K, PROF.thigh), body(thighM))}{shape(limbPath(g.K, g.A, PROF.shin), body(hl.has('calves') && 'calves'))}{shape(footPath(g.A, g.T), body())}
      {shape(limbPath(g.S, g.E, PROF.upperArm), body(armM))}{shape(limbPath(g.E, g.W, PROF.forearm), body(hl.has('forearm') && 'forearm'))}
      {shape(cap(g.S, hl.has('rear') && !hl.has('delts') ? -2 : 0), body((hl.has('delts') && 'delts') || (hl.has('rear') && 'rear')))}
      {gripAt(grip, g.W, p.fa)}
    </g>
  );
}

/** Recorrido del punto que más se mueve (mano, pie, cadera…), dibujado como flecha. */
function motionPath(pattern: Pattern, L: Lens) {
  if (pattern.loop && pattern.loop !== 'rep') return null;
  const keys = ['W', 'A', 'head', 'H', 'K', 'E'] as const;
  const g0 = geometry(pattern.a, pattern.view, L), g1 = geometry(pattern.b, pattern.view, L);
  const best = keys.map((k) => [k, len(sub(g1[k], g0[k]))] as const).sort((x, y) => y[1] - x[1])[0];
  if (best[1] < 12) return null;
  const pts: V[] = [];
  for (let i = 0; i <= 12; i++) {
    const g = geometry(mix(pattern.a, pattern.b, 0.06 + (i / 12) * 0.88), pattern.view, L);
    pts.push(g[best[0]]);
  }
  // desplazar la flecha un poco hacia afuera del cuerpo para que no tape la figura
  const d = `M${pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' L')}`;
  const end = pts[pts.length - 1], prev = pts[pts.length - 3];
  const u = unit(sub(end, prev)), nrm: V = [-u[1], u[0]];
  const head = `M${f1(end[0] - u[0] * 6 + nrm[0] * 4)},${f1(end[1] - u[1] * 6 + nrm[1] * 4)} L${f1(end[0])},${f1(end[1])} L${f1(end[0] - u[0] * 6 - nrm[0] * 4)},${f1(end[1] - u[1] * 6 - nrm[1] * 4)}`;
  return <g className="fx-arrow"><path d={d} /><path d={head} /></g>;
}

export function ExerciseFigure({ pattern, size = 120, still = false, className = '', label, phase }: { pattern: Pattern; size?: number; still?: boolean; className?: string; label?: string; phase?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [ms, setMs] = useState(1200);
  useEffect(() => {
    if (still || phase != null || reducedMotion()) return;
    let unsub: (() => void) | null = null;
    const el = ref.current;
    const io = typeof IntersectionObserver !== 'undefined' && el
      ? new IntersectionObserver(([en]) => {
        if (en.isIntersecting && !unsub) unsub = subscribe(setMs);
        else if (!en.isIntersecting && unsub) { unsub(); unsub = null; }
      })
      : null;
    if (io && el) io.observe(el); else unsub = subscribe(setMs);
    return () => { io?.disconnect(); unsub?.(); };
  }, [still, phase]);
  const k = phase ?? (still ? 1 : repPhase(ms, pattern.loop));
  const L = { ...BASE, ...pattern.lens };
  const g = geometry(mix(pattern.a, pattern.b, k), pattern.view, L);
  const uid = useId().replace(/:/g, '');
  const ids: Look = { skin: `sk${uid}`, far: `fr${uid}`, hl: `hl${uid}`, hlFar: `hf${uid}` };
  return (
    <svg ref={ref} className={`fx ${className}`} viewBox="0 -14 200 172" width={size} height={size * 0.86} role="img" aria-label={label ?? 'Animación del ejercicio'}>
      <defs>
        <linearGradient id={ids.skin} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--fig-skin-1)" /><stop offset="1" stopColor="var(--fig-skin-2)" /></linearGradient>
        <linearGradient id={ids.far} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--fig-far-1)" /><stop offset="1" stopColor="var(--fig-far-2)" /></linearGradient>
        <linearGradient id={ids.hl} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--fig-hl-1)" /><stop offset="1" stopColor="var(--fig-hl-2)" /></linearGradient>
        <linearGradient id={ids.hlFar} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--fig-hlfar-1)" /><stop offset="1" stopColor="var(--fig-hlfar-2)" /></linearGradient>
      </defs>
      {floor()}
      {motionPath(pattern, L)}
      {pattern.back?.(g)}
      <Figure g={g} hl={new Set(pattern.hl)} grip={pattern.grip} ids={ids} />
      {pattern.front?.(g)}
    </svg>
  );
}

/** Atajo: figura del ejercicio por id/nombre. */
export function ExerciseAnim({ ex, size, still, className }: { ex: { id?: string; exerciseId?: string; name: string }; size?: number; still?: boolean; className?: string }) {
  return <ExerciseFigure pattern={animFor(ex)} size={size} still={still} className={className} label={`Cómo se hace: ${ex.name}`} />;
}
