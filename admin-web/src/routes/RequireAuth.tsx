import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="spinner-page">Loading…</div>;
  if (!session) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}
