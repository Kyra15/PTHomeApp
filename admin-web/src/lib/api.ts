/** Base URL of the Flask backend (same one the iOS app's health checks hit). */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface SignUpInput {
  accessCode: string;
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
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': input.accessCode,
      },
      body: JSON.stringify({
        email: input.email.trim(),
        password: input.password,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      }),
    });
    if (resp.status === 201) return { error: null };
    if (resp.status === 401) return { error: 'Incorrect organization access code.' };
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
