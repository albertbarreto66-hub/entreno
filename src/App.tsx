import { createContext, useContext, useEffect, useState } from 'react';
import { IconComidas, IconEntrenar, IconHoy, IconProgreso } from './components/icons';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { ensureInitialized, getSchedule, getSettings } from './lib/app';
import { addDays, formatLong, todayKey } from './lib/dates';
import { useNow } from './lib/hooks';
import { applyReminders } from './lib/notify';
import { Meals } from './screens/Meals';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { Today } from './screens/Today';
import { Train } from './screens/Train';

export type Route = 'hoy' | 'entrenar' | 'comidas' | 'progreso' | 'ajustes';
const ROUTES: Route[] = ['hoy', 'entrenar', 'comidas', 'progreso', 'ajustes'];

interface Nav { route: Route; go: (r: Route, sub?: string) => void; sub: string; date: string; setDate: (d: string) => void; today: string }
const NavCtx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(NavCtx);

function readHash(): { route: Route; sub: string } {
  const [, r, sub] = location.hash.split('/');
  return { route: ROUTES.includes(r as Route) ? (r as Route) : 'hoy', sub: sub ?? '' };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [{ route, sub }, setRoute] = useState(readHash);
  const now = useNow();
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [lastToday, setLastToday] = useState(today);

  // Si pasa la medianoche con la app abierta y estabas viendo "hoy", avanzar al nuevo día.
  useEffect(() => {
    if (today !== lastToday) { if (date === lastToday) setDate(today); setLastToday(today); }
  }, [today, lastToday, date, now]);

  useEffect(() => {
    ensureInitialized()
      .then(async () => {
        setReady(true);
        const [s, sch] = await Promise.all([getSettings(), getSchedule()]);
        applyReminders(sch, s.systemNotifications).catch(() => {});
        navigator.storage?.persisted?.().then((p) => { if (!p) navigator.storage.persist?.(); }).catch(() => {});
      })
      .catch((e) => setErr(String(e?.message ?? e)));
    const h = () => setRoute(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const go = (r: Route, s = '') => { location.hash = `#/${r}${s ? '/' + s : ''}`; window.scrollTo(0, 0); };

  if (err) return <div className="boot"><h1>No se pudo abrir el almacenamiento</h1><p>{err}</p><p className="muted">Puede pasar en modo privado o si el navegador bloquea el almacenamiento local.</p></div>;
  if (!ready) return <div className="boot"><p className="muted">Cargando…</p></div>;

  const isToday = date === today;
  return (
    <NavCtx.Provider value={{ route, sub, go, date, setDate, today }}>
      <ToastProvider>
        <ConfirmProvider>
          <div className="app">
            <header className="topbar">
              <div className="datenav">
                <button className="btn ghost icon" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}>‹</button>
                <button className="date-title" onClick={() => setDate(today)} aria-label={isToday ? 'Hoy' : 'Volver a hoy'}>
                  <span className="date-main">{isToday ? 'Hoy' : formatLong(date)}</span>
                  <span className="date-sub">{isToday ? formatLong(date) : 'Tocá para volver a hoy'}</span>
                </button>
                <button className="btn ghost icon" aria-label="Día siguiente" onClick={() => setDate(addDays(date, 1))} disabled={date >= today}>›</button>
              </div>
              <button className={`avatar ${route === 'ajustes' ? 'on' : ''}`} onClick={() => go('ajustes')} aria-label="Perfil y ajustes">A</button>
            </header>
            {!isToday && <div className="past-banner" role="note">Estás viendo y editando el {formatLong(date)}.</div>}
            <main className="content">
              {route === 'hoy' && <Today />}
              {route === 'entrenar' && <Train />}
              {route === 'comidas' && <Meals />}
              {route === 'progreso' && <Progress />}
              {route === 'ajustes' && <SettingsScreen />}
            </main>
            <nav className="tabbar" aria-label="Navegación principal">
              {([['hoy', 'Hoy', <IconHoy />], ['entrenar', 'Entrenar', <IconEntrenar />], ['comidas', 'Comidas', <IconComidas />], ['progreso', 'Progreso', <IconProgreso />]] as const).map(([r, l, ic]) => (
                <button key={r} className={route === r ? 'on' : ''} aria-current={route === r ? 'page' : undefined} onClick={() => go(r)}>
                  <span className="tab-ic" aria-hidden="true">{ic}</span>{l}
                </button>
              ))}
            </nav>
          </div>
        </ConfirmProvider>
      </ToastProvider>
    </NavCtx.Provider>
  );
}
