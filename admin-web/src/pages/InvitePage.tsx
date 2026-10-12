import { useParams } from 'react-router-dom';
import { Logo } from '../components/Logo';

/**
 * Public landing page for the link in the invite email: /invite/<code>.
 * Shows the code (to type into the app) and a button that opens the app directly. It never calls the API,
 * so a leaked link reveals nothing beyond the code the person already has; accepting still requires
 * signing in to the app with the invited, confirmed email address.
 */
export function InvitePage() {
  const { code = '' } = useParams();
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
  const pretty = clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;

  return (
    <div className="auth-page">
      <div className="auth-form-side" style={{ flex: 1 }}>
        <div className="auth-form" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Logo size={52} />
          </div>
          <h2>You've been invited to Kinetic</h2>
          <p className="subtitle">Your therapist invited you to connect for your home exercise program.</p>
          <div className="code-box" style={{ justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
            <span className="cell-sub">Your invite code</span>
            <span className="code-box-code">{pretty || '—'}</span>
          </div>
          <a className="btn-primary" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }} href={`kinetic://invite/${clean}`}>
            Open in the Kinetic app
          </a>
          <ol className="invite-steps">
            <li>Install the Kinetic app and create an account with the email this invitation was sent to.</li>
            <li>Confirm your email using the link we send you.</li>
            <li>Tap the button above, or enter the code in the app under “Connect with a doctor”.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
