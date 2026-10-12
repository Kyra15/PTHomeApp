import { CheckCircle2, AlertCircle, AlertTriangle, Circle } from 'lucide-react';

export type Status = 'on-track' | 'missed' | 'alert' | 'none';

const CONFIG: Record<Status, { label: string; icon: typeof CheckCircle2; className: string }> = {
  'on-track': { label: 'On track', icon: CheckCircle2, className: 'pill-success' },
  missed: { label: 'Missed sessions', icon: AlertCircle, className: 'pill-danger' },
  alert: { label: 'Form alert', icon: AlertTriangle, className: 'pill-warning' },
  none: { label: 'Not started', icon: Circle, className: 'pill-neutral' },
};

export function StatusPill({ status }: { status: Status }) {
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <span className={`pill ${className}`}>
      <Icon size={14} strokeWidth={2.2} />
      {label}
    </span>
  );
}
