import { createClient } from '@supabase/supabase-js';

// Safe to ship in a web bundle: this is Supabase's low-privilege publishable key, and
// Row Level Security on every table enforces who can read/write what. NEVER put the
// sb_secret_... key here or in any frontend code.
const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(
  supabaseConfigured ? url : 'https://placeholder.supabase.co',
  supabaseConfigured ? key : 'placeholder-key',
);
