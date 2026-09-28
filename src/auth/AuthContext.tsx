import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

type Result = { error: string | null };

interface AuthValue {
  session: Session | null;
  loading: boolean;
  fullName: string | null;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (fullName: string, email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const OFFLINE = "We couldn't reach the internet. Check your connection and try again.";

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) return OFFLINE;
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'We could not create that account. Try signing in instead.';
  }
  if (m.includes('password') && m.includes('at least')) return 'Please choose a longer password (6 or more characters).';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
  return 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    // Supabase recommends pausing token refresh while the app is in the background.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    if (!supabaseConfigured) return { error: 'The app is not connected to the server yet.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return { error: null };
      // Never reveal whether the email exists (avoids account enumeration).
      if (error.message.toLowerCase().includes('invalid login')) {
        return { error: 'Incorrect email or password.' };
      }
      if (error.message.toLowerCase().includes('not confirmed')) {
        return { error: 'Please confirm your email first, then sign in.' };
      }
      return { error: friendlyError(error.message) };
    } catch {
      return { error: OFFLINE };
    }
  }, []);

  const signUp = useCallback(
    async (fullName: string, email: string, password: string): Promise<Result> => {
      if (!supabaseConfigured) return { error: 'The app is not connected to the server yet.' };
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) return { error: friendlyError(error.message) };
        if (!data.session) {
          // Email confirmation is switched on in Supabase: no session until they confirm.
          return { error: 'Almost done! Check your email and tap the link to confirm, then sign in.' };
        }
        return { error: null };
      } catch {
        return { error: OFFLINE };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const fullName = (session?.user.user_metadata?.full_name as string | undefined) ?? null;

  const value = useMemo(
    () => ({ session, loading, fullName, signIn, signUp, signOut }),
    [session, loading, fullName, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
