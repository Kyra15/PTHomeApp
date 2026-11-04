import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Users, TrendingUp, Clock, ArrowRightLeft, ClipboardList } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { AppShell } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { StatusPill } from '../components/StatusPill';
import { Avatar } from '../components/Avatar';
import { InviteModal } from '../components/InviteModal';
import { TransferModal } from '../components/TransferModal';
import { formatDays, formatShortDate, listInvitations, listPatients } from '../lib/api';
import type { RosterPatient } from '../lib/api';

type Patient = RosterPatient;

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/**
 * Patients on the signed-in therapist's caseload (active care_links), from GET /therapist/patients:
 * program summary, 30-day adherence, last session and a status flag (on track / missed sessions /
 * not started). Click a patient to open their detail page and edit their exercise program (Flow 6).
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
      const { data, error: e } = await listPatients();
      if (cancelled) return;
      if (e || !data) {
        setError(e ?? "Couldn't load your patients. Please try again.");
        return;
      }
      setError(null);
      setPatients(data.patients);
    }
    load();
    listInvitations().then(({ data }) => {
      if (!cancelled && data) setPendingInvites(data.invitations.filter((i) => i.display_status === 'pending').length);
    });
    return () => {
      cancelled = true;
    };
  }, [session, reloadKey]);

  const navigate = useNavigate();

  function displayName(p: Patient): string {
    if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ');
    return p.full_name || p.email || 'Unnamed patient';
  }

  const avgAdherence = useMemo(() => {
    const vals = (patients ?? []).map((p) => p.adherence_pct).filter((v): v is number => v !== null);
    return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%` : '—';
  }, [patients]);

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
        <StatCard icon={TrendingUp} value={avgAdherence} label="Avg. adherence (30 days)" tone="accent" />
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
                  <tr key={p.id} className="patient-row-link" onClick={() => navigate(`/patients/${p.id}`)}>
                    <td>
                      <div className="patient-name-cell">
                        <Avatar name={name} />
                        <div>
                          <Link to={`/patients/${p.id}`} className="patient-link" onClick={(e) => e.stopPropagation()}>
                            <span className="name">{name}</span>
                          </Link>
                          {p.email ? <div className="cell-sub">{p.email}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="program-cell">
                      {p.program.exercise_count === 0 ? (
                        <span style={{ color: 'var(--text-secondary)' }}>No program assigned</span>
                      ) : (
                        <>
                          <div className="program-cell-main">
                            {p.program.exercise_count} exercise{p.program.exercise_count === 1 ? '' : 's'} ·{' '}
                            {formatDays(p.program.days_of_week)}
                          </div>
                          <div className="program-cell-sub">
                            {p.program.body_areas.slice(0, 2).join(', ')}
                            {p.program.body_areas.length > 2 ? ` +${p.program.body_areas.length - 2} more` : ''}
                          </div>
                        </>
                      )}
                    </td>
                    <td>{p.adherence_pct === null ? '—' : `${p.adherence_pct}%`}</td>
                    <td>{formatShortDate(p.last_session_date)}</td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <Link to={`/patients/${p.id}`} className="btn-secondary btn-small">
                          <ClipboardList size={14} />
                          {p.program.exercise_count === 0 ? 'Assign program' : 'Edit program'}
                        </Link>
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
