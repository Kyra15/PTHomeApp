import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

export function SignUpPage() {
  const { session, signUp } = useAuth();
  const [officeName, setOfficeName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signUp({ officeName, firstName, lastName, email, password });
    setBusy(false);
    if (err) setError(err); // on success the router redirects to the roster automatically
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div className="logo-row">
            <Logo size={52} />
          </div>
          <h1>
            Kinetic
            <br />
            Clinician Portal
          </h1>
          <p>
            Assign home-exercise programs, monitor real-time motion data, and track adherence
            for every patient on your caseload.
          </p>
        </div>
      </div>
      <div className="auth-form-side">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Create account</h2>
          <p className="subtitle">For licensed physical therapists and care teams.</p>
          {error ? (
            <div className="error-banner" role="alert" aria-live="polite">
              {error}
            </div>
          ) : null}
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
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="a.chen@rehabpartners.com"
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
          <div className="field">
            <label htmlFor="officeName">Office / clinic name (optional)</label>
            <input
              id="officeName"
              type="text"
              autoComplete="organization"
              placeholder="Rehab Partners"
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
            />
            <p className="field-hint">Use the same name as your coworkers so you can transfer patients to each other.</p>
          </div>
          <button className="btn-primary" type="submit" disabled={!canSubmit}>
            {busy ? 'Creating account…' : 'Create Account'}
          </button>
          <Link to="/sign-in" className="btn-text">
            I already have an account
          </Link>
        </form>
      </div>
    </div>
  );
}
