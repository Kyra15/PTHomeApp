import { useAuth } from '../auth/AuthContext';

/** Empty roster for task 1.5. Listing real patients and their programs is task 3.1+. */
export function RosterPage() {
  const { firstName, session, signOut } = useAuth();

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
      <div className="empty-state">
        <h2>No patients yet</h2>
        <p>Once you enroll a patient, they'll appear here with their program and progress.</p>
      </div>
    </div>
  );
}
