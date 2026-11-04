import { Alert } from 'react-native';
import { supabase, supabaseConfigProblem, supabaseKey, supabaseUrl } from '../lib/supabase';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const TIMEOUT_MS = 10000;

async function probe(url: string, headers: Record<string, string> = {}): Promise<{ status?: number; error?: string; ms: number; body?: string }> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const body = await r.text().catch(() => '');
    return { status: r.status, ms: Date.now() - started, body };
  } catch (e) {
    const msg = ctrl.signal.aborted ? `no answer after ${TIMEOUT_MS / 1000} s` : e instanceof Error ? e.message : String(e);
    return { error: msg, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

const isLocal = (url: string) => /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/]*\.local\b)/i.test(url);

function explainNetworkError(url: string): string {
  if (/^https?:\/\/(localhost|127\.)/i.test(url)) {
    return 'On a phone, localhost / 127.0.0.1 means the phone itself. Use your Mac\'s Wi-Fi IP or your Render URL in .env.local, then rebuild.';
  }
  if (isLocal(url)) {
    return 'Check that the phone is on the same Wi-Fi as the Mac, the server is running (flask … --host 0.0.0.0), and Settings → Privacy & Security → Local Network → Home PT Coach is ON.';
  }
  return 'The phone can\'t open this address. Check it for typos in .env.local (then rebuild the app), and try opening it in Safari on the phone.';
}

/** With the backend up, check it accepts this phone's sign-in (catches app and backend on different Supabase projects). */
async function checkSignedInRequest(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'Signed-in request: (sign in first to test this)';
  const r = await probe(`${API_BASE}/patient/today`, { Authorization: `Bearer ${token}` });
  if (r.status && r.status < 300) return 'Signed-in request: ✓ the app server accepts your sign-in';
  if (r.status === 401) {
    return 'Signed-in request: ✗ HTTP 401\nThe app server rejected your sign-in. On Render (or backend/.env), SUPABASE_URL must be the same project as the app\'s EXPO_PUBLIC_SUPABASE_URL ('
      + supabaseUrl + '), with that project\'s sb_secret_ key. Change it, then redeploy / restart the backend.';
  }
  if (r.status === 403) return 'Signed-in request: ✗ HTTP 403\nThis account is a doctor account. Sign in to the app with a patient account.';
  if (r.status) return `Signed-in request: ✗ HTTP ${r.status}\nThe app server had an error. Check its logs on Render (Logs tab).`;
  return `Signed-in request: ✗ ${r.error}`;
}

/** Tests the two servers the app talks to and shows the result in a popup. */
export async function runConnectionCheck(): Promise<void> {
  const lines: string[] = [];

  // 1. Supabase (sign-in, accounts)
  if (supabaseConfigProblem) {
    lines.push(`Sign-in server (Supabase): ✗\n${supabaseConfigProblem}`);
  } else {
    const r = await probe(`${supabaseUrl}/auth/v1/health`, { apikey: supabaseKey });
    const where = supabaseUrl.replace(/^https?:\/\//, '');
    if (r.status && r.status < 300) lines.push(`Sign-in server (Supabase): ✓\n${where} (${r.ms} ms)`);
    else if (r.status === 401 || r.status === 403) lines.push(`Sign-in server (Supabase): ✗ HTTP ${r.status}\n${where}\nThe publishable key in .env.local doesn't match this project.`);
    else if (r.status) lines.push(`Sign-in server (Supabase): ✗ HTTP ${r.status}\n${where}\nThe project may be paused. Open supabase.com → your project → Restore, wait ~1 minute, then try again.`);
    else lines.push(`Sign-in server (Supabase): ✗ ${r.error}\n${where}\n${explainNetworkError(supabaseUrl)}`);
  }

  // 2. Kinetic backend (programs, invitations, sessions)
  if (!API_BASE) {
    lines.push('App server (backend): ✗\nEXPO_PUBLIC_API_BASE_URL is empty in .env.local.');
  } else if (/your-backend/i.test(API_BASE)) {
    lines.push(`App server (backend): ✗\n${API_BASE} is still the example value from .env.example. Put your Render URL in .env.local, then rebuild.`);
  } else {
    const r = await probe(`${API_BASE}/health`);
    let backendDb = '';
    try {
      backendDb = String(JSON.parse(r.body ?? '{}').supabase ?? '');
    } catch {
      /* not JSON — handled below */
    }
    if (r.status && r.status < 300 && backendDb && backendDb !== 'connected') {
      lines.push(`App server (backend): ✗ it runs, but can't reach its Supabase (${backendDb})\n${API_BASE}\nOn Render (or backend/.env), set SUPABASE_URL to ${supabaseUrl || 'your project URL'} and SUPABASE_SECRET_KEY to that project's sb_secret_ key, then redeploy / restart.`);
    } else if (r.status && r.status < 300) {
      lines.push(`App server (backend): ✓\n${API_BASE} (${r.ms} ms)`);
      lines.push(await checkSignedInRequest());
    } else if (r.status) {
      lines.push(`App server (backend): ✗ HTTP ${r.status}\n${API_BASE}\nThe address answers but isn't the Kinetic backend, or it's still starting up (Render's free tier takes ~1 minute to wake).`);
    } else {
      const slow = /^https:\/\/[^/]*onrender\.com/i.test(API_BASE) ? '\nRender\'s free tier can take ~1 minute to wake up — try again in a minute.' : '';
      lines.push(`App server (backend): ✗ ${r.error}\n${API_BASE}\n${explainNetworkError(API_BASE)}${slow}`);
    }
  }

  Alert.alert('Connection check', lines.join('\n\n'));
}
