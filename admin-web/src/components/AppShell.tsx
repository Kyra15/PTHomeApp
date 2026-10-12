import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Sidebar + top bar + content shell used by every signed-in clinician-portal page. */
export function AppShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="app-topbar-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="app-topbar-actions">{actions}</div> : null}
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
