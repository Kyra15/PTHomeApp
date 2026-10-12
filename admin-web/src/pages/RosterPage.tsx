import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Users, TrendingUp, Clock, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { StatusPill } from '../components/StatusPill';
import { Avatar } from '../components/Avatar';
import { InviteModal } from '../components/InviteModal';
import { TransferModal } from '../components/TransferModal';
import { listInvitations } from '../lib/api';

interface Patient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  injuryArea: string | null;
}

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * Patients on the signed-in therapist's caseload: active rows in care_links (a patient can have
 * several therapists, so this replaced users.assigned_therapist_id in migration 0005).
 * Row Level Security (`care_links_select_therapist`, `is_therapist_of`) already restricts this to
 * only that therapist's patients — the explicit filters below are belt-and-suspenders.
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
  const [showInvite, setShowInvite] = useState(false);
  const [transferring, setTransferring] = useState<Patient | null>(null);
  const [pendingInvites, setPendingInvites] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session) return;
      const { data: links, error: usersError } = await supabase
        .from('care_links')
        .select('patient:users!care_links_patient_id_fkey(id, first_name, last_name, full_name, email)')
        .eq('therapist_id', session.user.id)
        .eq('status', 'active');

      if (cancelled) return;
      if (usersError) {
        setError("Couldn't load your patients. Please try again.");
        return;
      }
      setError(null);

      type Row = { id: string; first_name: string | null; last_name: string | null; full_name: string | null; email: string | null };
      const users: Row[] = ((links ?? []) as unknown as { patient: Row | null }[])
        .map((l) => l.patient)
        .filter((u): u is Row => Boolean(u))
        .sort((a, b) => (a.first_name ?? a.full_name ?? '').localeCompare(b.first_name ?? b.full_name ?? ''));

      const ids = users.map((u) => u.id);
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
        users.map((u) => ({
          id: u.id,
          firstName: u.first_name,
          lastName: u.last_name,
          fullName: u.full_name,
          email: u.email,
          injuryArea: injuryByUserId.get(u.id) ?? null,
        })),
      );
    }
    load();
    listInvitations().then(({ data }) => {
      if (!cancelled && data) setPendingInvites(data.invitations.filter((i) => i.display_status === 'pending').length);
    });
    return () => {
      cancelled = true;
    };
  }, [session, reloadKey]);

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
          <button className="btn-accent" onClick={() => setShowInvite(true)}>
            <Plus size={16} />
            Invite Patient
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
        <Link to="/invitations" className="stat-link">
          <StatCard
            icon={Clock}
            value={pendingInvites === null ? '—' : String(pendingInvites)}
            label="Pending invitations"
            tone="warning"
          />
        </Link>
      </div>

      {patients === null && !error ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading patients…</p>
      ) : null}

      {filtered && filtered.length === 0 && patients && patients.length === 0 ? (
        <div className="empty-state">
          <h2>No patients yet</h2>
          <p>
            Invite a patient by email. Once they accept, they'll appear here with their program and
            progress.
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
                <th aria-label="Actions" />
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
                        <div>
                          <span className="name">{name}</span>
                          {p.email ? <div className="cell-sub">{p.email}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td>{p.injuryArea ? `${p.injuryArea} · no program yet` : 'No program assigned'}</td>
                    <td>—</td>
                    <td>Never</td>
                    <td>
                      <StatusPill status="none" />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-secondary btn-small" onClick={() => setTransferring(p)}>
                          <ArrowRightLeft size={14} />
                          Transfer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {showInvite ? <InviteModal onClose={() => setShowInvite(false)} onCreated={reload} /> : null}
      {transferring ? (
        <TransferModal
          patientId={transferring.id}
          patientName={displayName(transferring)}
          onClose={() => setTransferring(null)}
          onTransferred={reload}
        />
      ) : null}
    </AppShell>
  );
}
