import { useEffect, useMemo, useState } from 'react';
import { Search, Smartphone, Activity, RotateCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { Modal } from '../components/Modal';

/** One row of public.exercises (migration 0006; seeded by 0007 from shared/exercise-library.json). */
interface LibraryExercise {
  id: string;
  slug: string;
  name: string;
  body_area: string;
  description: string | null;
  instructions: string[];
  positioning_tip: string | null;
  sensor_mode: 'tilt' | 'rotation';
  default_sets: number;
  default_reps: number;
  target_angle_deg: number | null;
  return_angle_deg: number | null;
  target_rotation_deg: number | null;
  est_minutes: number | null;
  difficulty: string | null;
  equipment: string | null;
  tags: string[];
  accent_color: string | null;
}

const AREA_ORDER = ['Shoulder', 'Elbow & Wrist', 'Back & Core', 'Hip', 'Knee', 'Ankle & Foot'];

/**
 * Exercise Library (F11 / task 3.2, pulled forward). Read straight from Supabase — the
 * `exercises_select` RLS policy lets any signed-in user read the library. Searchable by name, body
 * area, description and tags, filterable by body area, with an empty-search state. Assigning an
 * exercise to a patient is the program editor (task 3.3).
 */
export function ExerciseLibraryPage() {
  const [rows, setRows] = useState<LibraryExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const [open, setOpen] = useState<LibraryExercise | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('exercises')
      .select(
        'id, slug, name, body_area, description, instructions, positioning_tip, sensor_mode, default_sets, default_reps, target_angle_deg, return_angle_deg, target_rotation_deg, est_minutes, difficulty, equipment, tags, accent_color',
      )
      .eq('active', true)
      .order('name')
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) setError('Could not load the exercise library. Has migration 0006/0007 been run?');
        setRows((data as LibraryExercise[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const areas = useMemo(() => {
    const present = new Set((rows ?? []).map((r) => r.body_area));
    return [...AREA_ORDER.filter((a) => present.has(a)), ...[...present].filter((a) => !AREA_ORDER.includes(a)).sort()];
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? [])
      .filter((r) => !area || r.body_area === area)
      .filter((r) => !q || [r.name, r.body_area, r.description ?? '', ...(r.tags ?? [])].join(' ').toLowerCase().includes(q));
  }, [rows, query, area]);

  return (
    <AppShell
      title="Exercise Library"
      subtitle={rows ? `${rows.length} motion-tracked exercises` : 'Loading…'}
      actions={
        <div className="search-input">
          <Search size={16} />
          <input
            placeholder="Search exercises or tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search exercises"
          />
        </div>
      }
    >
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="filter-tabs" role="tablist" aria-label="Filter by body area">
        {[null, ...areas].map((a) => {
          const count = (rows ?? []).filter((r) => !a || r.body_area === a).length;
          return (
            <button
              key={a ?? 'all'}
              role="tab"
              aria-selected={area === a}
              className={`filter-tab${area === a ? ' filter-tab-active' : ''}`}
              onClick={() => setArea(a)}
            >
              {a ?? 'All'} <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {rows === null ? (
        <div className="coming-soon">Loading exercises…</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <h2>No exercises match</h2>
          <p>
            Nothing matches “{query}”{area ? ` in ${area}` : ''}. Try another word or{' '}
            <button
              className="btn-text"
              onClick={() => {
                setQuery('');
                setArea(null);
              }}
            >
              clear filters
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="exercise-grid">
          {shown.map((ex) => (
            <button key={ex.id} className="exercise-card" onClick={() => setOpen(ex)} style={{ borderTopColor: ex.accent_color ?? undefined }}>
              <div className="exercise-card-top">
                <span className="pill pill-neutral">{ex.body_area}</span>
                <span className="exercise-sensor" title={ex.sensor_mode === 'tilt' ? 'Tracked by tilt (accelerometer)' : 'Tracked by rotation (gyroscope)'}>
                  {ex.sensor_mode === 'tilt' ? <Activity size={15} /> : <RotateCw size={15} />}
                </span>
              </div>
              <h3>{ex.name}</h3>
              <p>{ex.description}</p>
              <div className="exercise-card-meta">
                {ex.default_sets} × {ex.default_reps} · ~{ex.est_minutes ?? 5} min · {ex.difficulty}
              </div>
            </button>
          ))}
        </div>
      )}

      {open ? (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div className="exercise-detail">
            <p className="exercise-detail-desc">{open.description}</p>
            <div className="exercise-detail-pills">
              <span className="pill pill-neutral">{open.body_area}</span>
              <span className="pill pill-neutral">Default {open.default_sets} × {open.default_reps}</span>
              <span className="pill pill-neutral">~{open.est_minutes ?? 5} min</span>
              {open.difficulty ? <span className="pill pill-warning">{open.difficulty}</span> : null}
            </div>
            <h4>Patient instructions</h4>
            <ol>
              {open.instructions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <h4>
              <Smartphone size={14} /> Phone positioning
            </h4>
            <p>{open.positioning_tip}</p>
            <h4>Tracking</h4>
            <p>
              {open.sensor_mode === 'tilt'
                ? `Tilt (accelerometer): a rep counts when the phone tilts ${open.target_angle_deg}° from the start position and returns within ${open.return_angle_deg}°.`
                : `Rotation (gyroscope): a rep counts after ${open.target_rotation_deg}° of total rotation.`}
            </p>
            {open.equipment && open.equipment !== 'none' ? (
              <p>
                <strong>Equipment:</strong> {open.equipment}
              </p>
            ) : null}
            {open.tags?.length ? (
              <div className="exercise-detail-pills">
                {open.tags.map((t) => (
                  <span key={t} className="pill pill-success">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
