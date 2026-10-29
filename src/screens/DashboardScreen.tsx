import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { BigButton } from '../components/BigButton';
import { supabase } from '../lib/supabase';
import { getMyInvitations, getToday, sendTestPush } from '../lib/api';
import type { TodayItem, TodayResponse, WeekDay } from '../lib/api';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

interface Doctor {
  id: string;
  name: string;
}

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nameOf(u: { first_name?: string | null; last_name?: string | null; full_name?: string | null }) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || 'Your doctor';
}

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function dayName(iso: string, todayIso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const diff = Math.round((date.getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000);
  return diff === 1 ? 'Tomorrow' : WEEKDAY_NAMES[date.getDay()];
}

/**
 * Task 2.1 — Home Dashboard (F03, mockup docs/mockups/p2-home.png): streak + this week, today's program
 * from the scheduled-delivery API (2.2), quick stats, and what's up next. Also keeps the care-team /
 * invitation pieces from the linking sprint.
 */
export function DashboardScreen({ navigation }: Props) {
  const { firstName, session, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [inv, links, t] = await Promise.all([
      getMyInvitations(),
      supabase
        .from('care_links')
        .select('therapist:users!care_links_therapist_id_fkey(id, first_name, last_name, full_name)')
        .eq('patient_id', session.user.id)
        .eq('status', 'active'),
      getToday(),
    ]);
    setPendingCount(inv.data?.invitations.length ?? 0);
    type T = { id: string; first_name: string | null; last_name: string | null; full_name: string | null };
    setDoctors(
      ((links.data ?? []) as unknown as { therapist: T | null }[])
        .map((l) => l.therapist)
        .filter((x): x is T => Boolean(x))
        .map((x) => ({ id: x.id, name: nameOf(x) })),
    );
    if (t.data) setToday(t.data);
    setError(t.error);
    setLoading(false);
  }, [session]);

  // Refresh when shown (e.g. back from a finished exercise) and when the app returns to the foreground
  // (which is also when "today" may have rolled over to a new day).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const startItem = (item: TodayItem) =>
    navigation.navigate('Exercise', { exerciseId: item.exercise.slug, planId: item.plan_id, sets: item.sets, reps: item.reps });

  const openProfile = () =>
    Alert.alert(firstName ?? 'Your account', session?.user.email ?? undefined, [
      { text: 'Connect with a doctor', onPress: () => navigation.navigate('Connect') },
      {
        text: 'Send a test notification',
        onPress: async () => {
          const r = await sendTestPush();
          Alert.alert(
            r.data?.sent ? 'Test sent' : 'Not sent',
            r.data?.sent ? `Sent to ${r.data.devices} device${r.data.devices === 1 ? '' : 's'}. It should arrive in a few seconds.` : r.error ?? 'Please try again.',
          );
        },
      },
      { text: 'Check motion sensors', onPress: () => navigation.navigate('SensorCheck') },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
      { text: 'Close', style: 'cancel' },
    ]);

  const initials = (firstName ?? session?.user.email ?? '?').slice(0, 2).toUpperCase();
  const remaining = today?.exercises.filter((e) => !e.done) ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingFor(new Date().getHours())}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {firstName ?? 'Welcome'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pendingCount ? `${pendingCount} new invitations` : 'Invitations'}
            onPress={() => navigation.navigate('Connect')}
            style={styles.iconButton}
          >
            <Text style={styles.bell}>🔔</Text>
            {pendingCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Account menu" onPress={openProfile} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>

        {pendingCount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`You have ${pendingCount} doctor invitation${pendingCount > 1 ? 's' : ''}. Tap to review.`}
            onPress={() => navigation.navigate('Connect')}
            style={styles.invite}
          >
            <Text style={styles.inviteTitle}>{pendingCount === 1 ? 'A doctor invited you' : `${pendingCount} doctors invited you`}</Text>
            <Text style={styles.inviteBody}>Tap to review and accept.</Text>
          </Pressable>
        )}

        {loading && !today ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : error && !today ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Couldn&apos;t load today&apos;s exercises</Text>
            <Text style={styles.muted}>{error}</Text>
            <View style={{ height: spacing.md }} />
            <BigButton label="Try Again" onPress={load} />
          </View>
        ) : today ? (
          <>
            {today.status !== 'no_program' && <StreakCard today={today} />}
            <ProgramCard today={today} doctors={doctors} remaining={remaining} onStart={startItem} />
            {today.status !== 'no_program' && (
              <View style={styles.statsRow}>
                <StatTile
                  icon="📈"
                  value={today.stats.adherence_pct === null ? '—' : `${today.stats.adherence_pct}%`}
                  label="Adherence (30 days)"
                />
                <StatTile
                  icon="🎯"
                  value={
                    today.stats.rom_change_deg === null
                      ? '—'
                      : `${today.stats.rom_change_deg > 0 ? '+' : ''}${today.stats.rom_change_deg}°`
                  }
                  label="Range of motion, this month"
                />
              </View>
            )}
            {today.up_next && (today.status === 'complete' || today.status === 'rest_day') && (
              <>
                <Text style={styles.sectionTitle}>Up Next · {dayName(today.up_next.date, today.date)}</Text>
                {today.up_next.exercises.map((e) => (
                  <View key={e.plan_id} style={styles.upNextRow}>
                    <View style={[styles.dot, { backgroundColor: e.exercise.accent_color ?? colors.primary }]} />
                    <Text style={styles.rowTitle}>{e.exercise.name}</Text>
                    <Text style={styles.muted}>
                      {e.sets} × {e.reps}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        ) : null}

        {doctors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your care team</Text>
            <Text style={styles.muted}>{doctors.map((d) => d.name).join(' · ')}</Text>
          </>
        )}
      </ScrollView>
      <View style={styles.buttons}>
        <BigButton label="Exercise Library" variant="secondary" onPress={() => navigation.navigate('Home')} />
      </View>
    </SafeAreaView>
  );
}

function StreakCard({ today }: { today: TodayResponse }) {
  return (
    <View style={styles.card}>
      <View style={styles.streakHeader}>
        <Text style={styles.cardTitle}>⚡ {today.streak}-day streak</Text>
        <Text style={styles.muted}>This week</Text>
      </View>
      <View style={styles.weekRow}>
        {today.week.map((d, i) => (
          <WeekDot key={d.date} day={d} letter={WEEK_LETTERS[i]} />
        ))}
      </View>
      {today.next_milestone && (
        <Text style={[styles.muted, { marginTop: spacing.sm }]}>
          {today.next_milestone - today.streak} more {today.next_milestone - today.streak === 1 ? 'day' : 'days'} to your{' '}
          {today.next_milestone}-day badge
        </Text>
      )}
    </View>
  );
}

const DOT_STYLE: Record<WeekDay['state'], { bg: string; fg: string; border?: string; label: string }> = {
  done: { bg: colors.motionSuccess, fg: colors.textOnDark, label: 'done' },
  today: { bg: colors.action, fg: colors.textOnDark, label: 'today' },
  missed: { bg: colors.dangerSoft, fg: colors.danger, label: 'missed' },
  upcoming: { bg: colors.surface, fg: colors.textSecondary, border: colors.textSecondary, label: 'scheduled' },
  rest: { bg: colors.restSoft, fg: colors.textSecondary, label: 'rest day' },
};

function WeekDot({ day, letter }: { day: WeekDay; letter: string }) {
  const s = DOT_STYLE[day.state];
  const glyph = day.state === 'done' ? '✓' : day.state === 'missed' ? '✕' : letter;
  return (
    <View style={styles.weekCol} accessible accessibilityLabel={`${day.date}: ${s.label}`}>
      <View style={[styles.weekDot, { backgroundColor: s.bg, borderColor: s.border ?? s.bg }]}>
        <Text style={[styles.weekGlyph, { color: s.fg }]}>{glyph}</Text>
      </View>
      <Text style={styles.weekLetter}>{letter}</Text>
    </View>
  );
}

function ProgramCard({
  today,
  doctors,
  remaining,
  onStart,
}: {
  today: TodayResponse;
  doctors: Doctor[];
  remaining: TodayItem[];
  onStart: (i: TodayItem) => void;
}) {
  if (today.status === 'no_program') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>No exercises yet</Text>
        <Text style={styles.muted}>
          {doctors.length
            ? "Your care team is setting up your program. Once they do, today's exercises will show up here."
            : 'Connect with your doctor or therapist to get your exercise program. Tap the bell to enter an invite code.'}
        </Text>
      </View>
    );
  }
  if (today.status === 'paused' || today.status === 'ended') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{today.status === 'paused' ? 'Your program is paused' : 'Your program has ended'}</Text>
        <Text style={styles.muted}>
          {today.status === 'paused'
            ? "Your care team has paused your exercises for now. You don't need to do anything until they turn it back on."
            : 'Nice work finishing your program! Talk with your care team about what comes next.'}
        </Text>
      </View>
    );
  }
  if (today.status === 'rest_day') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rest day</Text>
        <Text style={styles.muted}>Nothing is scheduled for today. Enjoy the break!</Text>
      </View>
    );
  }

  const done = today.status === 'complete';
  return (
    <>
      <Text style={styles.sectionTitle}>Today&apos;s Program</Text>
      <View style={[styles.card, !done && styles.programCard]}>
        <Text style={styles.cardTitle}>{done ? "Today's session complete 🎉" : `${remaining.length} of ${today.exercises.length} left`}</Text>
        {!done && <Text style={styles.muted}>About {today.remaining_minutes} minutes</Text>}
        <View style={{ marginTop: spacing.sm }}>
          {today.exercises.map((item) => (
            <Pressable
              key={item.plan_id}
              accessibilityRole="button"
              accessibilityLabel={`${item.exercise.name}, ${item.sets} sets of ${item.reps}. ${item.done ? 'Done.' : 'Not done yet.'}`}
              onPress={() => onStart(item)}
              style={({ pressed }) => [styles.exerciseRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.check, item.done ? styles.checkDone : { borderColor: item.exercise.accent_color ?? colors.border }]}>
                {item.done && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, item.done && styles.rowDone]}>{item.exercise.name}</Text>
                <Text style={styles.muted}>
                  {item.sets} sets × {item.reps} reps{item.attempted && !item.done ? ' · started' : ''}
                  {doctors.length > 1 ? ` · ${item.therapist_name}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
        {!done && remaining.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <BigButton
              label={remaining.length === today.exercises.length ? "▶  Start Today's Session" : '▶  Continue Session'}
              accentColor={colors.action}
              onPress={() => onStart(remaining[0])}
            />
          </View>
        )}
      </View>
    </>
  );
}

function StatTile({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={[styles.card, styles.statTile]} accessible accessibilityLabel={`${label}: ${value === '—' ? 'not enough data yet' : value}`}>
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  greeting: { ...type.caption, color: colors.textSecondary },
  title: { ...type.h1, color: colors.textPrimary },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.textOnDark, fontWeight: '800', fontSize: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.textOnDark, fontWeight: '800', fontSize: 20 },
  invite: { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.md },
  inviteTitle: { ...type.h2, color: colors.textOnDark },
  inviteBody: { ...type.body, color: colors.textOnDark, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  programCard: { backgroundColor: '#FFF8F5', borderColor: colors.actionSoft },
  cardTitle: { ...type.h2, color: colors.textPrimary },
  muted: { ...type.caption, color: colors.textSecondary },
  sectionTitle: { ...type.h2, color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  weekCol: { alignItems: 'center', gap: 4 },
  weekDot: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  weekGlyph: { fontWeight: '800', fontSize: 18 },
  weekLetter: { ...type.caption, fontSize: 15, color: colors.textSecondary, fontWeight: '700' },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
  },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.motionSuccess, borderColor: colors.motionSuccess },
  checkMark: { color: colors.textOnDark, fontWeight: '800', fontSize: 18 },
  rowTitle: { ...type.body, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  rowDone: { color: colors.textSecondary },
  chevron: { fontSize: 34, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1 },
  statValue: { ...type.h1, color: colors.textPrimary, marginTop: 4 },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  buttons: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, paddingTop: spacing.sm },
});
