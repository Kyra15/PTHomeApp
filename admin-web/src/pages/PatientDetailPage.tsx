import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarCheck,
  Check,
  Flame,
  Plus,
  RotateCw,
  Search,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { StatusPill } from '../components/StatusPill';
import {
  DAY_LETTERS,
  DAY_NAMES,
  formatDays,
  formatShortDate,
  getPatientProgram,
  listLibrary,
  savePatientProgram,
} from '../lib/api';
import type { PatientProgram, ProgramExercise } from '../lib/api';

const AREA_ORDER = ['Shoulder', 'Elbow & Wrist', 'Back & Core', 'Hip', 'Knee', 'Ankle & Foot'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const MAX_SETS = 10;
const MAX_REPS = 50;

interface DraftItem {
  exercise: ProgramExercise;
  sets: number;
  reps: number;
  days: number[];
}

function toDraft(data: PatientProgram): DraftItem[] {
  return data.program.map((p) => ({ exercise: p.exercise, sets: p.sets, reps: p.reps, days: [...p.days_of_week] }));
}

function sameDraft(a: DraftItem[], b: DraftItem[]): boolean {
  return JSON.stringify(a.map((i) => [i.exercise.id, i.sets, i.reps, [...i.days].sort()])) ===
    JSON.stringify(b.map((i) => [i.exercise.id, i.sets, i.reps, [...i.days].sort()]));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Patient Detail & Program editor (Flow 6 / F10, F12). Shows the patient's stats and recent sessions,
 * and lets the signed-in clinician build their program from the exercise library: sets, reps and which
 * days of the week, reorder, remove, then Save. Saving replaces only THIS clinician's prescriptions —
 * other clinicians' exercises for the same patient are shown read-only.
 */
export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const [data, setData] = useState<PatientProgram | null>(null);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [library, setLibrary] = useState<ProgramExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPatientProgram(patientId).then(({ data: d, error: e }) => {
      if (cancelled) return;
      if (e || !d) {
        setError(e ?? "Couldn't load this patient.");
        return;
      }
      setData(d);
      setDraft(toDraft(d));
    });
    listLibrary().then(({ data: d }) => !cancelled && setLibrary(d?.exercises ?? []));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const dirty = data ? !sameDraft(draft, toDraft(data)) : false;

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const [todayDow] = useState(() => new Date().getDay());
  const dueToday = draft.filter((i) => i.days.includes(todayDow)).length;
  const draftMinutes = draft.reduce((m, i) => m + (i.exercise.est_minutes ?? 5), 0);

  function update(index: number, change: Partial<DraftItem>) {
    setNotice(null);
    setDraft((d) => d.map((item, i) => (i === index ? { ...item, ...change } : item)));
  }

  function toggleDay(index: number, day: number) {
    const days = draft[index].days;
    update(index, { days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort() });
  }

  function move(index: number, by: -1 | 1) {
    setNotice(null);
    setDraft((d) => {
      const next = d.slice();
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  }

  function remove(index: number) {
    setNotice(null);
    setDraft((d) => d.filter((_, i) => i !== index));
  }

  function add(ex: ProgramExercise) {
    setNotice(null);
    setDraft((d) => [
      ...d,
      {
        exercise: ex,
        sets: ex.default_sets,
        reps: ex.default_reps,
        // New exercises follow the schedule of the last one added, or every day for a new program.
        days: d.length ? [...d[d.length - 1].days] : [...EVERY_DAY],
      },
    ]);
  }

  const validation = useMemo(() => {
    if (draft.length === 0) return 'Add at least one exercise before saving.';
    const noDays = draft.find((i) => i.days.length === 0);
    if (noDays) return `Pick at least one day for ${noDays.exercise.name}.`;
    return null;
  }, [draft]);

  async function save() {
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    const { data: d, error: e } = await savePatientProgram(
      patientId,
      draft.map((i) => ({ exercise_id: i.exercise.id, sets: i.sets, reps: i.reps, days_of_week: i.days })),
    );
    setSaving(false);
    if (e || !d) {
      setError(e ?? 'Could not save the program.');
      return;
    }
    setData(d);
    setDraft(toDraft(d));
    const first = d.patient.name.split(' ')[0];
    setNotice(
      d.today.length
        ? `Program saved. ${first} will see ${d.today.length} exercise${d.today.length === 1 ? '' : 's'} in the app today.`
        : `Program saved. Nothing is scheduled today — ${first}'s next exercises appear on their next scheduled day.`,
    );
  }

  if (error && !data) {
    return (
      <AppShell title="Patient" subtitle="">
        <div className="error-banner" role="alert">
          {error}
        </div>
        <Link to="/patients" className="btn-secondary">
          <ArrowLeft size={14} /> Back to patients
        </Link>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Patient" subtitle="Loading…">
        <p style={{ color: 'var(--text-secondary)' }}>Loading patient…</p>
      </AppShell>
    );
  }

  const { stats } = data;
  return (
    <AppShell
      title={data.patient.name}
      subtitle={data.patient.email ?? undefined}
      actions={
        <>
          <Link to="/patients" className="btn-secondary">
            <ArrowLeft size={14} />
            All patients
          </Link>
          {dirty ? (
            <button className="btn-secondary" onClick={() => setDraft(toDraft(data))} disabled={saving}>
              Discard changes
            </button>
          ) : null}
          <button className="btn-accent" onClick={save} disabled={!dirty || saving}>
            <Check size={16} />
            {saving ? 'Saving…' : 'Save program'}
          </button>
        </>
      }
    >
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard
          icon={TrendingUp}
          value={stats.adherence_pct === null ? '—' : `${stats.adherence_pct}%`}
          label="Adherence (30 days)"
          tone="accent"
        />
        <StatCard icon={Flame} value={String(stats.streak)} label="Day streak" />
        <StatCard icon={CalendarCheck} value={formatShortDate(stats.last_session_date)} label="Last session" />
        <div className="stat-card">
          <Activity size={20} strokeWidth={2} />
          <div className="stat-card-pill">
            <StatusPill status={stats.status} />
          </div>
          <div className="stat-card-label">Status</div>
        </div>
      </div>

      <section className="section-card">
        <div className="section-head">
          <div>
            <h2>Exercise program</h2>
            <p className="section-sub">
              {draft.length === 0
                ? 'No exercises yet.'
                : `${draft.length} exercise${draft.length === 1 ? '' : 's'} · ~${draftMinutes} min per full session · ${dueToday} due today (${DAY_NAMES[todayDow]})`}
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            Add exercise
          </button>
        </div>

        {draft.length === 0 ? (
          <div className="program-empty">
            <p>Build {data.patient.name.split(' ')[0]}'s home program from the motion-tracked exercise library.</p>
            <button className="btn-accent" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add the first exercise
            </button>
          </div>
        ) : (
          <ol className="program-list">
            {draft.map((item, i) => (
              <li key={item.exercise.id} className="program-row">
                <span className="program-swatch" style={{ background: item.exercise.accent_color ?? 'var(--teal)' }} />
                <div className="program-name">
                  <div className="program-title">
                    {item.exercise.name}
                    {item.days.includes(todayDow) ? <span className="pill pill-success pill-tiny">Today</span> : null}
                  </div>
                  <div className="cell-sub">
                    {item.exercise.sensor_mode === 'tilt' ? <Activity size={12} /> : <RotateCw size={12} />}{' '}
                    {item.exercise.body_area} · {item.exercise.sensor_mode === 'tilt' ? 'tilt tracked' : 'rotation tracked'} ·{' '}
                    {formatDays(item.days)}
                  </div>
                </div>

                <label className="num-field">
                  <span>Sets</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_SETS}
                    value={item.sets}
                    aria-label={`${item.exercise.name} sets`}
                    onChange={(e) => update(i, { sets: clamp(Number(e.target.value) || 1, 1, MAX_SETS) })}
                  />
                </label>
                <span className="times">×</span>
                <label className="num-field">
                  <span>Reps</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_REPS}
                    value={item.reps}
                    aria-label={`${item.exercise.name} reps`}
                    onChange={(e) => update(i, { reps: clamp(Number(e.target.value) || 1, 1, MAX_REPS) })}
                  />
                </label>

                <div className="day-toggles" role="group" aria-label={`${item.exercise.name} days`}>
                  {DAY_LETTERS.map((letter, d) => (
                    <button
                      key={d}
                      type="button"
                      className={`day-toggle${item.days.includes(d) ? ' day-toggle-on' : ''}`}
                      aria-pressed={item.days.includes(d)}
                      aria-label={DAY_NAMES[d]}
                      title={DAY_NAMES[d]}
                      onClick={() => toggleDay(i, d)}
                    >
                      {letter}
                    </button>
                  ))}
                </div>

                <div className="row-actions">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Move down">
                    <ArrowDown size={15} />
                  </button>
                  <button className="icon-btn icon-btn-danger" onClick={() => remove(i)} aria-label={`Remove ${item.exercise.name}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {dirty ? <p className="section-foot">Unsaved changes. They apply from today once you save.</p> : null}
      </section>

      {data.other_programs.length ? (
        <section className="section-card">
          <div className="section-head">
            <div>
              <h2>From other clinicians</h2>
              <p className="section-sub">Read-only — prescribed by the patient's other care-team members.</p>
            </div>
          </div>
          <ul className="simple-list">
            {data.other_programs.map((p) => (
              <li key={p.plan_id}>
                <strong>{p.exercise.name}</strong> · {p.sets} × {p.reps} · {formatDays(p.days_of_week)}
                <span className="cell-sub"> — {p.therapist_name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section-card">
        <div className="section-head">
          <div>
            <h2>Recent sessions</h2>
            <p className="section-sub">Recorded by the patient's iPhone during each exercise.</p>
          </div>
        </div>
        {data.recent_sessions.length === 0 ? (
          <p className="section-sub">No sessions yet. They'll show up here as soon as the patient finishes an exercise.</p>
        ) : (
          <table className="patient-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exercise</th>
                <th>Reps</th>
                <th>Avg. range</th>
                <th>Time</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_sessions.map((s) => (
                <tr key={s.id}>
                  <td>{formatShortDate(s.local_date)}</td>
                  <td>{s.exercise_name}</td>
                  <td>
                    {s.reps_completed ?? '—'}
                    {s.target_reps_total ? ` / ${s.target_reps_total}` : ''}
                  </td>
                  <td>{s.avg_rom_degrees === null ? '—' : `${Math.round(s.avg_rom_degrees)}°`}</td>
                  <td>{s.duration_seconds === null ? '—' : `${Math.floor(s.duration_seconds / 60)}:${String(s.duration_seconds % 60).padStart(2, '0')}`}</td>
                  <td>
                    <span className={`pill ${s.completed ? 'pill-success' : 'pill-warning'}`}>
                      {s.completed ? 'Completed' : 'Ended early'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {adding ? (
        <AddExerciseModal
          library={library}
          chosen={new Set(draft.map((i) => i.exercise.id))}
          onAdd={add}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </AppShell>
  );
}

function AddExerciseModal({
  library,
  chosen,
  onAdd,
  onClose,
}: {
  library: ProgramExercise[] | null;
  chosen: Set<string>;
  onAdd: (ex: ProgramExercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);

  const areas = useMemo(() => {
    const present = new Set((library ?? []).map((r) => r.body_area));
    return AREA_ORDER.filter((a) => present.has(a)).concat([...present].filter((a) => !AREA_ORDER.includes(a)).sort());
  }, [library]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library ?? [])
      .filter((r) => !area || r.body_area === area)
      .filter((r) => !q || [r.name, r.body_area, r.description ?? '', ...(r.tags ?? [])].join(' ').toLowerCase().includes(q));
  }, [library, query, area]);

  return (
    <Modal title="Add exercises" onClose={onClose} wide>
      <div className="search-input modal-search">
        <Search size={16} />
        <input
          autoFocus
          placeholder="Search by name, body area or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the exercise library"
        />
      </div>
      <div className="filter-tabs filter-tabs-compact">
        {[null, ...areas].map((a) => (
          <button
            key={a ?? 'all'}
            className={`filter-tab${area === a ? ' filter-tab-active' : ''}`}
            onClick={() => setArea(a)}
          >
            {a ?? 'All'}
          </button>
        ))}
      </div>
      <div className="picker-list">
        {library === null ? <p className="section-sub">Loading library…</p> : null}
        {library && shown.length === 0 ? <p className="section-sub">No exercises match “{query}”.</p> : null}
        {shown.map((ex) => {
          const added = chosen.has(ex.id);
          return (
            <div key={ex.id} className="picker-row">
              <span className="program-swatch" style={{ background: ex.accent_color ?? 'var(--teal)' }} />
              <div className="program-name">
                <div className="program-title">{ex.name}</div>
                <div className="cell-sub">
                  {ex.body_area} · {ex.default_sets} × {ex.default_reps} · ~{ex.est_minutes ?? 5} min ·{' '}
                  {ex.sensor_mode === 'tilt' ? 'tilt' : 'rotation'}
                </div>
              </div>
              <button
                className={added ? 'btn-secondary btn-small' : 'btn-accent btn-small'}
                disabled={added}
                onClick={() => onAdd(ex)}
                aria-label={added ? `${ex.name} added` : `Add ${ex.name}`}
              >
                {added ? <Check size={14} /> : <Plus size={14} />}
                {added ? 'Added' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="btn-primary btn-inline" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
