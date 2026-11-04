import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// These two values are safe to ship in the app (the publishable key has low privileges and
// Row Level Security protects the data). NEVER put the sb_secret_... key here.
// They come from .env.local and are baked in when the app's JavaScript is bundled — a Release build keeps the
// values it was built with, so rebuild after changing .env.local.
export const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
export const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

/** Why the Supabase settings can't be used, or null when they look fine. */
export const supabaseConfigProblem: string | null = !supabaseUrl || !supabaseKey
  ? 'The app is not connected to the server yet (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are empty in .env.local).'
  : /YOUR-PROJECT-REF|paste-your/i.test(supabaseUrl + supabaseKey)
    ? 'The app still has the example Supabase settings from .env.example. Put your real project URL and publishable key in .env.local, then rebuild.'
    : !/^https?:\/\/[^/\s]+$/i.test(supabaseUrl)
      ? `EXPO_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co (it is "${supabaseUrl}").`
      : null;

export const supabaseConfigured = supabaseConfigProblem === null;

/** e.g. "abcd1234.supabase.co", for error messages. */
export const supabaseHost = supabaseConfigured ? supabaseUrl.replace(/^https?:\/\//i, '') : '';

export const supabase = createClient(
  supabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseConfigured ? supabaseKey : 'placeholder-key',
  {
    auth: {
      storage: AsyncStorage, // keeps the patient signed in across app launches
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
