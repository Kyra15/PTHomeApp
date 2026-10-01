import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

type Result = { error: string | null };

// Admins (therapists/nurses) are provisioned by the org, not self-serve (F02 #2) — so there is
// no sign-up here, only sign-in.
interface AuthValue {
  session: Session | null;
  loading: boolean;
  firstName: string | null;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const OFFLINE = "We couldn't reach the server. Check your connection and try again.";
// Shown both for a wrong password AND for a deactivated account, so neither case reveals
// whether the account exists or its status (F02 edge cases).
const BLOCKED_OR_WRONG = 'Incorrect email or password, or this account is not active. Contact your administrator if you believe this is an error.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Reject anyone who isn't an active therapist, even if their Supabase credentials are valid
  // (e.g. a patient account, or a therapist who was deactivated after their last sign-in).
  const rejectIfNotActiveTherapist = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.from('users').select('role, active').single();
    if (error || !data || data.role !== 'therapist' || data.active === false) {
      await supabase.auth.signOut();
      return BLOCKED_OR_WRONG;
    }
    return null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const blocked = await rejectIfNotActiveTherapist();
        if (blocked) {
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, [rejectIfNotActiveTherapist]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!supabaseConfigured) return { error: 'The portal is not connected to the server yet.' };
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) {
            return { error: OFFLINE };
          }
          // Covers "invalid login credentials" and any other auth error with one generic message.
          return { error: BLOCKED_OR_WRONG };
        }
        const blocked = await rejectIfNotActiveTherapist();
        if (blocked) return { error: blocked };
        return { error: null };
      } catch {
        return { error: OFFLINE };
      }
    },
    [rejectIfNotActiveTherapist],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const firstName = (session?.user.user_metadata?.first_name as string | undefined) ?? null;

  const value = useMemo(
    () => ({ session, loading, firstName, signIn, signOut }),
    [session, loading, firstName, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
