import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { Modal } from './Modal';
import { createInvitation, formatCode } from '../lib/api';
import type { DeliveryInfo, Invitation } from '../lib/api';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/** Invite a patient by email. After sending, shows the code so it can also be read out or texted. */
export function InviteModal({ onClose, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<({ invitation: Invitation } & DeliveryInfo) | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await createInvitation(email.trim(), name.trim());
    setBusy(false);
    if (err || !data) return setError(err);
    setSent(data);
    onCreated();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the code is on screen to read out */
    }
  }

  if (sent) {
    const code = formatCode(sent.invitation.code);
    return (
      <Modal title="Invitation created" onClose={onClose}>
        <p className="modal-text">
          {sent.email_sent
            ? `We emailed ${sent.invitation.email}.`
            : "Email delivery isn't set up (or failed), so share the code or link below yourself."}
          {sent.existing_patient
            ? sent.push_sent
              ? ' They already use Kinetic, so they also got a push notification and an in-app invitation.'
              : ' They already use Kinetic, so the invitation will show up on their app home screen.'
            : ' They will create an account with this email, confirm it, then enter the code.'}
        </p>
        <div className="code-box">
          <span className="code-box-code">{code}</span>
          <button className="btn-secondary" onClick={() => copy(sent.invite_link)}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy invite link'}
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn-accent" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Invite a patient" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-text">
          They'll get an email with a code and a link. Existing Kinetic users also get a push notification.
        </p>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="invite-email">Patient email</label>
          <input
            id="invite-email"
            type="email"
            required
            autoFocus
            placeholder="patient@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="invite-name">Name (optional)</label>
          <input id="invite-name" placeholder="Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-accent" disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
