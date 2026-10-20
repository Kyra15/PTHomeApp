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
