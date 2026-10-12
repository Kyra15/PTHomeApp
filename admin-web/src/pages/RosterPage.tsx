import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Users, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { StatusPill } from '../components/StatusPill';
import { Avatar } from '../components/Avatar';

interface Patient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  injuryArea: string | null;
}

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * Patients assigned to the signed-in therapist (users.assigned_therapist_id = me).
 * Row Level Security (`users_select_patients` in migration 0001) already restricts this to only
 * that therapist's patients — the explicit filters below are belt-and-suspenders, not the only
 * thing standing between therapists and each other's patients.
 *
 * There's no enrollment, program-assignment, or session flow yet (later milestones), so program,
 * adherence, and last-session are honest placeholders rather than invented numbers — matching
 * the mockup's layout without pretending data exists that the app doesn't track yet.
 */
export function RosterPage() {
  const { session } = useAuth();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session) return;
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, full_name')
        .eq('role', 'patient')
        .eq('assigned_therapist_id', session.user.id)
        .order('first_name', { ascending: true });

      if (cancelled) return;
      if (usersError) {
        setError("Couldn't load your patients. Please try again.");
        return;
      }

      const ids = (users ?? []).map((u) => u.id);
      let injuryByUserId = new Map<string, string | null>();
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('health_profiles')
          .select('user_id, injury_area')
          .in('user_id', ids);
        injuryByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p.injury_area]));
      }

      if (cancelled) return;
      setPatients(
        (users ?? []).map((u) => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          fullName: u.full_name,
          injuryArea: injuryByUserId.get(u.id) ?? null,
        })),
      );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  function displayName(p: Patient): string {
    if (p.firstName || p.lastName) return [p.firstName, p.lastName].filter(Boolean).join(' ');
    return p.fullName || 'Unnamed patient';
  }

  const filtered = useMemo(() => {
    if (!patients) return null;
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => displayName(p).toLowerCase().includes(q));
  }, [patients, query]);

  return (
    <AppShell
      title="Patient Roster"
      subtitle={TODAY}
      actions={
        <>
          <div className="search-input">
            <Search size={16} />
            <input
              placeholder="Search patients..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search patients"
            />
          </div>
          <button
            className="btn-accent"
            disabled
            title="Patient enrollment isn't built yet"
          >
            <Plus size={16} />
            Add Patient
          </button>
        </>
      }
    >
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard icon={Users} value={patients ? String(patients.length) : '—'} label="Active patients" />
        <StatCard icon={TrendingUp} value="—" label="Avg. adherence" tone="accent" />
        <StatCard icon={AlertCircle} value="0" label="Need attention" tone="warning" />
        <StatCard icon={Calendar} value="0" label="Sessions this week" />
      </div>

      {patients === null && !error ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading patients…</p>
      ) : null}

      {filtered && filtered.length === 0 && patients && patients.length === 0 ? (
        <div className="empty-state">
          <h2>No patients yet</h2>
          <p>
            Once a patient is enrolled and assigned to you, they'll appear here with their
            program and progress.
          </p>
        </div>
      ) : null}

      {filtered && filtered.length === 0 && patients && patients.length > 0 ? (
        <div className="empty-state">
          <h2>No matches</h2>
          <p>No patient name matches "{query}".</p>
        </div>
      ) : null}

      {filtered && filtered.length > 0 ? (
        <div className="table-card">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Program</th>
                <th>Adherence</th>
                <th>Last Session</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const name = displayName(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="patient-name-cell">
                        <Avatar name={name} />
                        <span className="name">{name}</span>
                      </div>
                    </td>
                    <td>{p.injuryArea ? `${p.injuryArea} · no program yet` : 'No program assigned'}</td>
                    <td>—</td>
                    <td>Never</td>
                    <td>
                      <StatusPill status="none" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppShell>
  );
}
