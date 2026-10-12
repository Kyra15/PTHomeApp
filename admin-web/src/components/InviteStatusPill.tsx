import { CheckCircle2, Clock, XCircle, Ban, Hourglass } from 'lucide-react';
import type { InviteDisplayStatus } from '../lib/api';

const CONFIG: Record<InviteDisplayStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'pill-warning' },
  accepted: { label: 'Activated', icon: CheckCircle2, className: 'pill-success' },
  expired: { label: 'Expired', icon: Hourglass, className: 'pill-neutral' },
  declined: { label: 'Declined', icon: XCircle, className: 'pill-danger' },
  revoked: { label: 'Cancelled', icon: Ban, className: 'pill-neutral' },
};

export function InviteStatusPill({ status }: { status: InviteDisplayStatus }) {
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <span className={`pill ${className}`}>
      <Icon size={14} strokeWidth={2.2} />
      {label}
    </span>
  );
}
