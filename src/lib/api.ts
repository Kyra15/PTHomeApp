import { supabase } from './supabase';

/** Base URL of the Flask backend, e.g. https://kinetic-backend.onrender.com (no trailing slash). */
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export interface PendingInvitation {
  id: string;
  therapist_name: string;
  created_at: string | null;
  expires_at: string | null;
}

type ApiResult<T> = { data: T | null; error: string | null; code?: string };

const OFFLINE = "We couldn't reach the server. Check your connection and try again.";

async function authed<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!API_BASE) return { data: null, error: 'The app is not connected to the server yet.' };
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return { data: null, error: 'Please sign in again.' };
    const resp = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        data: null,
        error: typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.',
        code: typeof body.code === 'string' ? body.code : undefined,
      };
    }
    return { data: body as T, error: null };
  } catch {
    return { data: null, error: OFFLINE };
  }
}

export const getMyInvitations = () =>
  authed<{ invitations: PendingInvitation[]; email_confirmed: boolean }>('/patient/invitations');

export const acceptInvitation = (id: string) =>
  authed<{ linked: boolean; therapist_name: string }>(`/patient/invitations/${id}/accept`, { method: 'POST' });

export const declineInvitation = (id: string) =>
  authed<{ declined: boolean }>(`/patient/invitations/${id}/decline`, { method: 'POST' });

export const acceptByCode = (code: string) =>
  authed<{ linked: boolean; therapist_name: string }>('/patient/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const registerPushToken = (token: string, platform: string) =>
  authed<{ ok: boolean }>('/patient/push-token', { method: 'POST', body: JSON.stringify({ token, platform }) });

// ---------- Today / schedule / sessions (tasks 1.7, 2.1–2.4) ----------

export interface LibraryExercise {
  id: string;
  slug: string;
  name: string;
  body_area: string;
  description: string | null;
  est_minutes: number | null;
  accent_color: string | null;
}

export interface TodayItem {
  plan_id: string;
  sets: number;
  reps: number;
  therapist_id: string;
  therapist_name: string;
  done: boolean;
  attempted: boolean;
  exercise: LibraryExercise;
}

export type DayState = 'done' | 'missed' | 'today' | 'upcoming' | 'rest';

export interface WeekDay {
  date: string;
  scheduled: number;
  done: number;
  complete: boolean;
  state: DayState;
  is_today: boolean;
}

export type TodayStatus = 'no_program' | 'paused' | 'ended' | 'rest_day' | 'due' | 'complete';

export interface TodayResponse {
  date: string;
  status: TodayStatus;
  exercises: TodayItem[];
  remaining_minutes: number;
  up_next: { date: string; exercises: TodayItem[] } | null;
  week: WeekDay[];
  streak: number;
  next_milestone: number | null;
  stats: { adherence_pct: number | null; rom_change_deg: number | null };
}

/** The phone's own calendar day (YYYY-MM-DD) — "today" follows the patient's time zone (F04). */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const getToday = () => authed<TodayResponse>(`/patient/today?date=${localDateString()}`);

export interface SessionUpload {
  plan_id: string;
  local_date: string;
  reps_completed: number;
  sets_completed: number;
  target_sets: number;
  target_reps: number;
  duration_seconds: number;
  avg_rom_degrees: number | null;
  completed: boolean;
  summary: Record<string, unknown>;
}

export const saveSession = (body: SessionUpload) =>
  authed<{ session: { id: string; local_date: string; completed: boolean } }>('/patient/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** Task 1.7: ask the backend to send a test push to this account's registered phones. */
export const sendTestPush = () => authed<{ sent: boolean; devices: number }>('/patient/push-test', { method: 'POST' });
