import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';

interface Patient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  injuryArea: string | null;
}

/**
 * Patients assigned to the signed-in therapist (users.assigned_therapist_id = me).
 * Row Level Security (`users_select_patients` in migration 0001) already restricts this to only
 * that therapist's patients — the explicit filters below are belt-and-suspenders, not the only
 * thing standing between therapists and each other's patients.
 *
 * There's no enrollment flow yet (that's task 3.1+), so this will show "No patients yet" until
 * a patient's `assigned_therapist_id` is set, which for now has to be done by hand in the
 * Supabase table editor.
 */
export function RosterPage() {
  const { firstName, session, signOut } = useAuth();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Patient Roster</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {firstName ? `${firstName} · ` : ''}
            {session?.user.email}
          </span>
          <button className="btn-link" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="page-body">
        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        {patients === null && !error ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading patients…</p>
        ) : null}

        {patients && patients.length === 0 ? (
          <div className="empty-state">
            <h2>No patients yet</h2>
            <p>Once a patient is enrolled and assigned to you, they'll appear here with their program and progress.</p>
          </div>
        ) : null}

        {patients && patients.length > 0 ? (
          <div className="patient-list">
            {patients.map((p) => (
              <div className="patient-card" key={p.id}>
                <div>
                  <div className="name">{displayName(p)}</div>
                  <div className="meta">Program and progress coming soon</div>
                </div>
                {p.injuryArea ? <span className="injury-badge">{p.injuryArea}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
