import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { listColleagues, transferPatient } from '../lib/api';
import type { Colleague } from '../lib/api';

interface Props {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onTransferred: () => void;
}

/** Hand a patient (and the exercises you prescribed) to another therapist in the same office. */
export function TransferModal({ patientId, patientName, onClose, onTransferred }: Props) {
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listColleagues().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      setColleagues(data?.colleagues ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    const { error: err } = await transferPatient(patientId, target);
    setBusy(false);
    if (err) return setError(err);
    onTransferred();
    onClose();
  }

  return (
    <Modal title={`Transfer ${patientName}`} onClose={onClose}>
      <p className="modal-text">
        They'll move to the therapist you pick, along with the exercises you prescribed. Other doctors treating
        this patient aren't affected. The patient gets a notification.
      </p>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {colleagues === null ? <p className="modal-text">Loading therapists…</p> : null}
      {colleagues && colleagues.length === 0 ? (
        <p className="modal-text">
          There are no other active therapists in your office yet. Ask your administrator to add them to your office.
        </p>
      ) : null}
      {colleagues && colleagues.length > 0 ? (
        <div className="field">
          <label htmlFor="transfer-to">Transfer to</label>
          <select id="transfer-to" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a therapist…</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-accent" disabled={!target || busy} onClick={confirm}>
          {busy ? 'Transferring…' : 'Transfer patient'}
        </button>
      </div>
    </Modal>
  );
}
