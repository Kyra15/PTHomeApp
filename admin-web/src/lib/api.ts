import { supabase } from './supabase';

/** Base URL of the Flask backend (same one the iOS app's health checks hit). */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface SignUpInput {
  officeName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function provisionTherapist(input: SignUpInput): Promise<{ error: string | null }> {
  if (!API_BASE) return { error: 'The portal is not connected to the server yet.' };
  try {
    const resp = await fetch(`${API_BASE}/admin/therapists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email.trim(),
        password: input.password,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        office_name: input.officeName.trim(),
      }),
    });
    if (resp.status === 201) return { error: null };
    const body = await resp.json().catch(() => ({}));
    if (resp.status === 400 && typeof body.error === 'string') {
      // Validation errors are fine to show as-is; Supabase auth errors (e.g. "already
      // registered") come through the same field.
      const msg = body.error.toLowerCase();
      if (msg.includes('already') && msg.includes('regist')) {
        return { error: 'An account with that email already exists. Try signing in instead.' };
      }
      if (msg.includes('password')) {
        return { error: 'Please choose a longer password (6 or more characters).' };
      }
      return { error: 'Please fill in every field.' };
    }
    return { error: 'Something went wrong creating your account. Please try again.' };
  } catch {
    return { error: "We couldn't reach the server. Check your connection and try again." };
  }
}

// ---------- Authenticated calls (invitations + transfers) ----------

export type InviteDisplayStatus = 'pending' | 'expired' | 'declined' | 'revoked' | 'accepted';

export interface Invitation {
  id: string;
  email: string;
  patient_name: string | null;
  code: string;
  status: string;
  display_status: InviteDisplayStatus;
  existing_patient: boolean;
  email_sent_at: string | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
}

export interface DeliveryInfo {
  email_sent: boolean;
  /** null when sent; "not_configured" when the server has no RESEND_API_KEY; otherwise why sending failed. */
  email_error: string | null;
  push_sent: boolean;
  existing_patient: boolean;
  invite_link: string;
}

export interface Colleague {
  id: string;
  name: string;
}

type ApiResult<T> = { data: T | null; error: string | null };

async function authed<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!API_BASE) return { data: null, error: 'The portal is not connected to the server yet.' };
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { data: null, error: 'Your session expired. Please sign in again.' };
    const resp = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { data: null, error: typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.' };
    }
    return { data: body as T, error: null };
  } catch {
    return { data: null, error: "We couldn't reach the server. Check your connection and try again." };
  }
}

export const listInvitations = () => authed<{ invitations: Invitation[] }>('/therapist/invitations');

export const createInvitation = (email: string, patientName: string) =>
  authed<{ invitation: Invitation } & DeliveryInfo>('/therapist/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, patient_name: patientName }),
  });

export const resendInvitation = (id: string) =>
  authed<{ invitation: Invitation } & DeliveryInfo>(`/therapist/invitations/${id}/resend`, { method: 'POST' });

export const revokeInvitation = (id: string) =>
  authed<{ invitation: Invitation }>(`/therapist/invitations/${id}/revoke`, { method: 'POST' });

export const listColleagues = () => authed<{ colleagues: Colleague[] }>('/therapist/colleagues');

export const transferPatient = (patientId: string, toTherapistId: string) =>
  authed<{ ok: boolean }>(`/therapist/patients/${patientId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ to_therapist_id: toTherapistId }),
  });

export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// ---------- Patients + programs (Flow 5 roster, Flow 6 program editor) ----------

/** The browser's own calendar day (YYYY-MM-DD), so "today" follows the clinician's time zone. */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type RosterStatus = 'on-track' | 'missed' | 'none';

export interface RosterPatient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  program: { exercise_count: number; body_areas: string[]; days_of_week: number[] };
  adherence_pct: number | null;
  last_session_date: string | null;
  status: RosterStatus;
}

export interface ProgramExercise {
  id: string;
  slug: string;
  name: string;
  body_area: string;
  description: string | null;
  sensor_mode: 'tilt' | 'rotation';
  default_sets: number;
  default_reps: number;
  est_minutes: number | null;
  difficulty: string | null;
  accent_color: string | null;
  tags: string[] | null;
}

export interface ProgramPlan {
  plan_id: string;
  sets: number;
  reps: number;
  days_of_week: number[];
  start_date: string | null;
  status: string;
  sort_order: number;
  exercise: ProgramExercise;
}

export interface RecentSession {
  id: string;
  local_date: string;
  completed_at: string | null;
  exercise_name: string;
  reps_completed: number | null;
  target_reps_total: number | null;
  avg_rom_degrees: number | null;
  duration_seconds: number | null;
  completed: boolean;
}

export interface PatientProgram {
  date: string;
  patient: { id: string; name: string; email: string | null };
  program: ProgramPlan[];
  other_programs: (ProgramPlan & { therapist_name: string })[];
  today: ProgramPlan[];
  stats: {
    adherence_pct: number | null;
    streak: number;
    rom_change_deg: number | null;
    last_session_date: string | null;
    status: RosterStatus;
  };
  recent_sessions: RecentSession[];
}

export interface ProgramItemInput {
  exercise_id: string;
  sets: number;
  reps: number;
  days_of_week: number[];
}

export const listPatients = () =>
  authed<{ date: string; patients: RosterPatient[] }>(`/therapist/patients?date=${localDateString()}`);

export const getPatientProgram = (patientId: string) =>
  authed<PatientProgram>(`/therapist/patients/${patientId}/program?date=${localDateString()}`);

export const savePatientProgram = (patientId: string, items: ProgramItemInput[]) =>
  authed<PatientProgram>(`/therapist/patients/${patientId}/program`, {
    method: 'PUT',
    body: JSON.stringify({ start_date: localDateString(), items }),
  });

export const listLibrary = () => authed<{ exercises: ProgramExercise[]; count: number }>('/therapist/exercises');

/** Sun..Sat, matching days_of_week (0 = Sunday). */
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDays(days: number[]): string {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Every day';
  if (set.join() === '1,2,3,4,5') return 'Weekdays';
  if (set.length === 0) return 'No days';
  // list in Mon→Sun order
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.includes(d)).map((d) => DAY_NAMES[d]).join(' · ');
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return 'Never';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yest.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
