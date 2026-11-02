import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  const S: V = [p.x + 15, p.y - L.torso + 6];
  const SL: V = [p.x - 15, S[1]];
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

/** Progreso A→B de una repetición: sube 1 s, pausa, baja 1,9 s, pausa. */
export function repPhase(ms: number, loop: Pattern['loop'] = 'rep') {
  if (loop === 'walk') return (Math.sin((ms / 1000) * Math.PI * 1.6) + 1) / 2;
  if (loop === 'breathe') return (Math.sin((ms / 1000) * Math.PI * 0.5) + 1) / 2;
  const T = 3700, x = ms % T;
  if (x < 1000) return ease(x / 1000);
  if (x < 1350) return 1;
  if (x < 3250) return 1 - ease((x - 1350) / 1900);
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

function Figure({ g, hl, grip }: { g: Geo; hl: Set<Muscle>; grip?: Grip }) {
  const L = (m: Muscle) => (hl.has(m) ? 'fx-hl' : 'fx-body');
  const Lfar = (m: Muscle) => (hl.has(m) ? 'fx-hl fx-far-hl' : 'fx-far');
  const armCls = hl.has('biceps') || hl.has('triceps') ? 'fx-hl' : 'fx-body';
  const armFar = hl.has('biceps') || hl.has('triceps') ? 'fx-hl fx-far-hl' : 'fx-far';
  const thighM: Muscle = hl.has('quads') ? 'quads' : 'hams';
  const p = g.pose;

  // zonas del torso (lateral): fracciones a lo largo del tronco y desplazamiento al frente (+) o a la espalda (−)
  const zone = (from: number, to: number, side: number, w = 7) => {
    const o = mul(g.n, side);
    return seg(add(add(g.H, o), mul(g.d, 46 * from)), add(add(g.H, o), mul(g.d, 46 * to)), w, 'fx-hl');
  };

  if (g.view === 'front') {
    const torso = `M${g.S[0] + 2},${g.S[1] - 3} L${g.HR[0] + 2},${g.H[1] + 2} L${g.HL[0] - 2},${g.H[1] + 2} L${g.SL[0] - 2},${g.SL[1] - 3} Z`;
    return (
      <g>
        {seg(g.HR, g.K, 11, L(thighM))}{seg(g.K, g.A, 9, hl.has('calves') ? 'fx-hl' : 'fx-body')}{seg(g.A, g.T, 5, 'fx-body')}
        {seg(g.HL, g.KL, 11, L(thighM))}{seg(g.KL, g.AL, 9, hl.has('calves') ? 'fx-hl' : 'fx-body')}{seg(g.AL, g.TL, 5, 'fx-body')}
        <path d={torso} className="fx-torso" strokeLinejoin="round" strokeWidth={6} />
        {hl.has('chest') && <>{seg([g.H[0] - 7, g.S[1] + 6], [g.H[0] - 7, g.S[1] + 9], 9, 'fx-hl')}{seg([g.H[0] + 7, g.S[1] + 6], [g.H[0] + 7, g.S[1] + 9], 9, 'fx-hl')}</>}
        {hl.has('abs') && seg([g.H[0], g.S[1] + 18], [g.H[0], g.H[1] - 8], 8, 'fx-hl')}
        {hl.has('glutes') && <>{P.dot([g.HR[0] + 4, g.H[1] - 2], 5.5, 'fx-hl-fill')}{P.dot([g.HL[0] - 4, g.H[1] - 2], 5.5, 'fx-hl-fill')}</>}
        {seg(g.N, [g.N[0], g.N[1] - 4], 7, 'fx-body')}
        <circle cx={g.head[0]} cy={g.head[1]} r={8.5} className="fx-head" />
        {seg(g.S, g.E, 8.5, armCls)}{seg(g.E, g.W, 7.5, hl.has('forearm') ? 'fx-hl' : 'fx-body')}
        {seg(g.SL, g.EL, 8.5, armCls)}{seg(g.EL, g.WL, 7.5, hl.has('forearm') ? 'fx-hl' : 'fx-body')}
        {hl.has('delts') && <>{P.dot(g.S, 6, 'fx-hl-fill')}{P.dot(g.SL, 6, 'fx-hl-fill')}</>}
        {gripAt(grip, g.W, p.fa)}{gripAt(grip, g.WL, -p.fa)}
      </g>
    );
  }
  return (
    <g>
      {/* extremidades lejanas */}
      {seg(add(g.H, [-3, -1.5]), g.K2, 11, Lfar(thighM))}{seg(g.K2, g.A2, 9, hl.has('calves') ? 'fx-hl fx-far-hl' : 'fx-far')}{seg(g.A2, g.T2, 5, 'fx-far')}
      {seg(add(g.S, [-3, -1.5]), g.E2, 8.5, armFar)}{seg(g.E2, g.W2, 7.5, hl.has('forearm') ? 'fx-hl fx-far-hl' : 'fx-far')}
      {gripAt(grip, g.W2, p.fa2 ?? p.fa)}
      {/* tronco y cabeza */}
      {seg(g.H, g.N, 15, 'fx-torso-line')}
      {hl.has('chest') && zone(0.62, 0.86, 3.2)}
      {hl.has('abs') && zone(0.16, 0.56, 3.2)}
      {hl.has('back') && zone(0.42, 0.84, -3.2)}
      {seg(g.N, add(g.N, mul(g.d, 5)), 7, 'fx-body')}
      <circle cx={g.head[0]} cy={g.head[1]} r={8.5} className="fx-head" />
      {hl.has('glutes') && P.dot(add(add(g.H, mul(g.n, -4)), mul(g.d, 2)), 6.5, 'fx-hl-fill')}
      {/* extremidades cercanas */}
      {seg(g.H, g.K, 12, L(thighM))}{seg(g.K, g.A, 9.5, hl.has('calves') ? 'fx-hl' : 'fx-body')}{seg(g.A, g.T, 5.5, 'fx-body')}
      {seg(g.S, g.E, 9, armCls)}{seg(g.E, g.W, 8, hl.has('forearm') ? 'fx-hl' : 'fx-body')}
      {hl.has('delts') && P.dot(g.S, 6, 'fx-hl-fill')}
      {hl.has('rear') && P.dot(add(g.S, mul(g.n, -3)), 5.5, 'fx-hl-fill')}
      {gripAt(grip, g.W, p.fa)}
    </g>
  );
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
  return (
    <svg ref={ref} className={`fx ${className}`} viewBox="0 -14 200 172" width={size} height={size * 0.86} role="img" aria-label={label ?? 'Animación del ejercicio'}>
      {floor()}
      {pattern.back?.(g)}
      <Figure g={g} hl={new Set(pattern.hl)} grip={pattern.grip} />
      {pattern.front?.(g)}
    </svg>
  );
}

/** Atajo: figura del ejercicio por id/nombre. */
export function ExerciseAnim({ ex, size, still, className }: { ex: { id?: string; exerciseId?: string; name: string }; size?: number; still?: boolean; className?: string }) {
  return <ExerciseFigure pattern={animFor(ex)} size={size} still={still} className={className} label={`Cómo se hace: ${ex.name}`} />;
}
