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
