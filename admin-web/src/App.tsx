import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './routes/RequireAuth';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { RosterPage } from './pages/RosterPage';
import { InvitationsPage } from './pages/InvitationsPage';
import { InvitePage } from './pages/InvitePage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <RosterPage />
              </RequireAuth>
            }
          />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route
            path="/invitations"
            element={
              <RequireAuth>
                <InvitationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/patients"
            element={
              <RequireAuth>
                <ComingSoonPage title="Patients" />
              </RequireAuth>
            }
          />
          <Route
            path="/exercise-library"
            element={
              <RequireAuth>
                <ComingSoonPage title="Exercise Library" />
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <ComingSoonPage title="Messages" />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <ComingSoonPage title="Settings" />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
