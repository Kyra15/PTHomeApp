import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { BigButton } from '../components/BigButton';
import { supabase } from '../lib/supabase';
import { getMyInvitations } from '../lib/api';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

interface Doctor {
  id: string;
  name: string;
}
interface PrescribedActivity {
  id: string;
  therapistId: string;
  name: string;
  sets: number;
  reps: number;
  days: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nameOf(u: { first_name?: string | null; last_name?: string | null; full_name?: string | null }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || 'Your doctor';
}

/**
 * Task 1.5 dashboard + the weekly-sprint linking features: an invitation banner, the patient's
 * care team, and "prescribed" activities grouped by the doctor who prescribed them (a patient can
 * have several doctors, each with their own activities). The full daily schedule is task 2.1.
 */
export function DashboardScreen({ navigation }: Props) {
  const { firstName, session, signOut } = useAuth();
  const greeting = firstName ? `Hello, ${firstName}` : 'Hello';
  const [pendingCount, setPendingCount] = useState(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activities, setActivities] = useState<PrescribedActivity[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [inv, links, plans] = await Promise.all([
      getMyInvitations(),
      supabase
        .from('care_links')
        .select('therapist:users!care_links_therapist_id_fkey(id, first_name, last_name, full_name)')
        .eq('patient_id', uid)
        .eq('status', 'active'),
      supabase
        .from('plans')
        .select('id, therapist_id, sets, reps, days_of_week, exercise:exercises(name)')
        .eq('patient_id', uid),
    ]);
    setPendingCount(inv.data?.invitations.length ?? 0);

    type T = { id: string; first_name: string | null; last_name: string | null; full_name: string | null };
    setDoctors(
      ((links.data ?? []) as unknown as { therapist: T | null }[])
        .map((l) => l.therapist)
        .filter((t): t is T => Boolean(t))
        .map((t) => ({ id: t.id, name: nameOf(t) })),
    );
    setActivities(
      ((plans.data ?? []) as unknown as {
        id: string; therapist_id: string; sets: number; reps: number; days_of_week: number[]; exercise: { name: string } | null;
      }[]).map((p) => ({
        id: p.id,
        therapistId: p.therapist_id,
        name: p.exercise?.name ?? 'Exercise',
        sets: p.sets,
        reps: p.reps,
        days: [...p.days_of_week].sort().map((d) => DAY_NAMES[d]).join(' · '),
      })),
    );
  }, [session]);

  // Refresh whenever the screen is shown (e.g. after accepting an invite) and when the app returns
  // from the background (e.g. the user tapped a push notification).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{greeting}</Text>

        {pendingCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`You have ${pendingCount} doctor invitation${pendingCount > 1 ? 's' : ''}. Tap to review.`}
            onPress={() => navigation.navigate('Connect')}
            style={styles.invite}
          >
            <Text style={styles.inviteTitle}>
              {pendingCount === 1 ? 'A doctor invited you' : `${pendingCount} doctors invited you`}
            </Text>
            <Text style={styles.inviteBody}>Tap to review and accept.</Text>
          </Pressable>
        ) : null}

        {doctors.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptyBody}>
              Your care team hasn't assigned a program to you yet. Once they do, today's exercises will show up here.
            </Text>
          </View>
        ) : (
          doctors.map((d) => {
            const mine = activities.filter((a) => a.therapistId === d.id);
            return (
              <View key={d.id} style={styles.card}>
                <Text style={styles.caption}>Prescribed by</Text>
                <Text style={styles.doctor}>{d.name}</Text>
                {mine.length === 0 ? (
                  <Text style={styles.emptyBody}>No activities prescribed yet.</Text>
                ) : (
                  mine.map((a) => (
                    <View key={a.id} style={styles.activity}>
                      <Text style={styles.activityName}>{a.name}</Text>
                      <Text style={styles.emptyBody}>
                        {a.sets} sets × {a.reps} reps · {a.days}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            );
          })
        )}

        <Text style={styles.caption}>Signed in as {session?.user.email}</Text>
      </ScrollView>
      <View style={styles.buttons}>
        <BigButton label="Connect with a doctor" onPress={() => navigation.navigate('Connect')} />
        <BigButton label="Try the demo exercises" variant="secondary" onPress={() => navigation.navigate('Home')} />
        <BigButton label="Sign Out" variant="outline" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  content: { paddingBottom: spacing.md },
  title: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  invite: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  inviteTitle: { ...type.h2, color: colors.textOnDark },
  inviteBody: { ...type.body, color: colors.textOnDark, marginTop: 4 },
  empty: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border },
  emptyTitle: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyBody: { ...type.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  doctor: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  activity: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  activityName: { ...type.bodyLarge, color: colors.textPrimary },
  caption: { ...type.caption, color: colors.textSecondary, marginTop: spacing.sm },
  buttons: { gap: spacing.md, paddingTop: spacing.md },
});
