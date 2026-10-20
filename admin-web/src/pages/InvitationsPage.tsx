import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Plus, RefreshCw, XCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { InviteModal, emailProblem } from '../components/InviteModal';
import { InviteStatusPill } from '../components/InviteStatusPill';
import { formatCode, listInvitations, resendInvitation, revokeInvitation } from '../lib/api';
import type { Invitation } from '../lib/api';

type Tab = 'all' | 'pending' | 'not-accepted' | 'activated';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'not-accepted', label: 'Not accepted' },
  { id: 'activated', label: 'Activated' },
];

function tabOf(inv: Invitation): Exclude<Tab, 'all'> {
  if (inv.display_status === 'pending') return 'pending';
  if (inv.display_status === 'accepted') return 'activated';
  return 'not-accepted'; // expired, declined, or cancelled
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export function InvitationsPage() {
  const [invites, setInvites] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await listInvitations();
    if (err) setError(err);
    else {
      setError(null);
      setInvites(data?.invitations ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, pending: 0, 'not-accepted': 0, activated: 0 };
    (invites ?? []).forEach((i) => {
      c.all += 1;
      c[tabOf(i)] += 1;
    });
    return c;
  }, [invites]);

  const rows = (invites ?? []).filter((i) => tab === 'all' || tabOf(i) === tab);

  async function resend(inv: Invitation) {
    setBusyId(inv.id);
    setNotice(null);
    const { data, error: err } = await resendInvitation(inv.id);
    setBusyId(null);
    if (err) return setError(err);
    setError(null);
    setNotice(data?.email_sent ? `Invitation re-sent to ${inv.email}.` : `${emailProblem(data?.email_error ?? null)} Code: ${formatCode(inv.code)}`);
    load();
  }

  async function cancel(inv: Invitation) {
    if (!window.confirm(`Cancel the invitation to ${inv.email}? Their code will stop working.`)) return;
    setBusyId(inv.id);
    const { error: err } = await revokeInvitation(inv.id);
    setBusyId(null);
    if (err) return setError(err);
    setError(null);
    setNotice(`Invitation to ${inv.email} cancelled.`);
    load();
  }

  async function copyCode(inv: Invitation) {
    try {
      await navigator.clipboard.writeText(inv.code);
      setNotice(`Code ${formatCode(inv.code)} copied.`);
    } catch {
      setNotice(`Code: ${formatCode(inv.code)}`);
    }
  }

  return (
    <AppShell
      title="Invitations"
      subtitle="Track who has been invited and who has activated their account"
      actions={
        <button className="btn-accent" onClick={() => setShowInvite(true)}>
          <Plus size={16} />
          Invite Patient
        </button>
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

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span className="tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {invites === null && !error ? <p style={{ color: 'var(--text-secondary)' }}>Loading invitations…</p> : null}

      {invites && rows.length === 0 ? (
        <div className="empty-state">
          <h2>{invites.length === 0 ? 'No invitations yet' : 'Nothing here'}</h2>
          <p>
            {invites.length === 0
              ? 'Invite a patient by email and they will appear here until they activate their account.'
              : 'No invitations match this filter.'}
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="table-card">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Expires</th>
                <th>Code</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const open = inv.display_status === 'pending';
                const reinvite = inv.display_status === 'expired';
                return (
                  <tr key={inv.id}>
                    <td>
                      <div className="name">{inv.patient_name || inv.email}</div>
                      {inv.patient_name ? <div className="cell-sub">{inv.email}</div> : null}
                      {inv.existing_patient ? <div className="cell-sub">Already uses Kinetic</div> : null}
                    </td>
                    <td>
                      <InviteStatusPill status={inv.display_status} />
                    </td>
                    <td>{fmt(inv.created_at)}</td>
                    <td>{open || reinvite ? fmt(inv.expires_at) : fmt(inv.responded_at)}</td>
                    <td className="mono">{open ? formatCode(inv.code) : '—'}</td>
                    <td>
                      <div className="row-actions">
                        {open || reinvite ? (
                          <>
                            <button className="icon-btn" title="Copy code" aria-label="Copy code" onClick={() => copyCode(inv)}>
                              <Copy size={16} />
                            </button>
                            <button
                              className="btn-secondary btn-small"
                              disabled={busyId === inv.id}
                              onClick={() => resend(inv)}
                            >
                              <RefreshCw size={14} />
                              {reinvite ? 'Renew & resend' : 'Resend'}
                            </button>
                            <button
                              className="icon-btn"
                              title="Cancel invitation"
                              aria-label="Cancel invitation"
                              disabled={busyId === inv.id}
                              onClick={() => cancel(inv)}
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {showInvite ? <InviteModal onClose={() => setShowInvite(false)} onCreated={load} /> : null}
    </AppShell>
  );
}
