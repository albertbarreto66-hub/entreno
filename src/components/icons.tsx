import type { ReactNode } from 'react';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const I = ({ children, size = 24 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...P} aria-hidden="true" focusable="false">{children}</svg>
);
type Props = { size?: number };

// Navegación
export const IconHoy = (p: Props) => <I {...p}><rect x="3.5" y="5" width="17" height="15" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></I>;
export const IconEntrenar = (p: Props) => <I {...p}><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></I>;
export const IconComidas = (p: Props) => <I {...p}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1.5-3 4-3 7v3h3" /></I>;
export const IconProgreso = (p: Props) => <I {...p}><path d="M4 19h16M5 15l4-4 3 3 6-7" /><path d="M15 7h3v3" /></I>;

// Categorías
export const IconSun = (p: Props) => <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></I>;
export const IconBowl = (p: Props) => <I {...p}><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" /></I>;
export const IconCup = (p: Props) => <I {...p}><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5v2.5M12 3.5v2.5" /></I>;
export const IconMoon = (p: Props) => <I {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></I>;
export const IconSteps = (p: Props) => <I {...p}><path d="M8.5 3.5c1.7 0 2.5 1.8 2.5 4s-.8 4-2.5 4S6 9.7 6 7.5s.8-4 2.5-4ZM6.5 14h4v1.5a2 2 0 0 1-4 0V14ZM15.5 7.5c1.7 0 2.5 1.8 2.5 4s-.8 4-2.5 4-2.5-1.8-2.5-4 .8-4 2.5-4ZM13.5 18h4v1a2 2 0 0 1-4 0v-1Z" /></I>;
export const IconDrop = (p: Props) => <I {...p}><path d="M12 3.5s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.5 12 3.5 12 3.5Z" /><path d="M9 15a3 3 0 0 0 3 3" /></I>;
export const IconBed = (p: Props) => <I {...p}><path d="M3 18V7M3 14h18v4M21 14v-2.5a3 3 0 0 0-3-3h-7v5.5" /><circle cx="7" cy="11" r="1.8" /></I>;
export const IconScale = (p: Props) => <I {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8 9.5a5 5 0 0 1 8 0M12 9.5l1.5-2" /></I>;
export const IconCamera = (p: Props) => <I {...p}><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4V8Z" /><circle cx="12" cy="13.5" r="3.5" /></I>;
export const IconFlame = (p: Props) => <I {...p}><path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-3.5-10C12 7 9 8 9 12c-1-.5-1.5-1.5-1.5-2.5C6.5 11 6 12.8 6 15a6 6 0 0 0 6 6Z" /></I>;
export const IconHeart = (p: Props) => <I {...p}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z" /></I>;
export const IconCheck = (p: Props) => <I {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></I>;
export const IconPlus = (p: Props) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconTimer = (p: Props) => <I {...p}><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2M9.5 3h5" /></I>;
export const IconLeaf = (p: Props) => <I {...p}><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19c3-4 6-6.5 10-8.5" /></I>;
export const IconNote = (p: Props) => <I {...p}><path d="M5 4h10l4 4v12H5V4Z" /><path d="M14 4v5h5M8.5 13h7M8.5 16.5h5" /></I>;
export const IconChevron = (p: Props & { dir?: 'left' | 'right' }) => <I size={p.size}><path d={p.dir === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} /></I>;
