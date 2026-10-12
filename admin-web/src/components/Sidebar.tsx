import { NavLink } from 'react-router-dom';
import { LayoutGrid, Users, ClipboardList, MessageSquare, Settings, LogOut } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/exercise-library', label: 'Exercise Library', icon: ClipboardList },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { signOut } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <Logo size={36} />
        <span className="sidebar-brand-text">Kinetic</span>
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
          >
            <Icon size={19} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </div>

      <button className="sidebar-link sidebar-logout" onClick={signOut}>
        <LogOut size={19} strokeWidth={2} />
        Log Out
      </button>
    </nav>
  );
}
