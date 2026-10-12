import type { ComponentType } from 'react';

interface Props {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  value: string;
  label: string;
  tone?: 'default' | 'accent' | 'warning';
}

export function StatCard({ icon: Icon, value, label, tone = 'default' }: Props) {
  return (
    <div className="stat-card">
      <Icon size={20} strokeWidth={2} />
      <div className={`stat-card-value stat-card-value-${tone}`}>{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
