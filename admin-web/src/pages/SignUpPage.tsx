import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SignUpPage() {
  const { session, signUp } = useAuth();
  const [accessCode, setAccessCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const canSubmit =
    accessCode.trim().length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signUp({ accessCode, firstName, lastName, email, password });
    setBusy(false);
    if (err) setError(err); // on success the router redirects to the roster automatically
  }

  return (
    <div className="center-page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Kinetic</h1>
        <p className="subtitle">Create a clinician account</p>
        {error ? (
          <div className="error-banner" role="alert" aria-live="polite">
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="accessCode">Organization access code</label>
          <input
            id="accessCode"
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            required
          />
          <p className="field-hint">Get this from your practice administrator.</p>
        </div>
        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password (6+ characters)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={!canSubmit}>
          {busy ? 'Creating account…' : 'Create Account'}
        </button>
        <Link to="/sign-in" className="btn-text">
          I already have an account
        </Link>
      </form>
    </div>
  );
}
