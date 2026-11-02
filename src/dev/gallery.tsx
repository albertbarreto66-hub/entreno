import { createRoot } from 'react-dom/client';
import '../index.css';
import { ExerciseFigure, PATTERNS } from '../components/ExerciseAnim';

// Solo para desarrollo: revisar las poses A, media y B de cada patrón.
createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
    {Object.entries(PATTERNS).map(([k, p]) => (
      <div key={k} className="card" style={{ padding: 6 }}>
        <b className="small">{k}</b>
        <div style={{ display: 'flex' }}>{[0, 0.5, 1].map((ph) => <ExerciseFigure key={ph} pattern={p} phase={ph} size={150} />)}</div>
      </div>
    ))}
  </div>,
);
