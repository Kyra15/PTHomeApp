import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getExerciseById } from '../data/exercises';
import { BigButton } from '../components/BigButton';
import { getToday, localDateString, saveSession } from '../lib/api';
import type { TodayItem } from '../lib/api';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Complete'>;

function CheckBadge({ color }: { color: string }) {
  return (
    <Svg width={120} height={120} viewBox="0 0 140 140">
      <Circle cx={70} cy={70} r={64} fill={color} />
      <Path d="M42 72 L62 92 L98 48" stroke={colors.textOnDark} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Session summary. For a program exercise (planId set) the session is saved to exercise_logs so
 * the dashboard marks it done (F04) and the therapist can review it later; practice runs from the
 * library aren't saved. Task 2.6 will add form score + comparison to the previous session.
 */
export function CompleteScreen({ route, navigation }: Props) {
  const { summary, planId } = route.params;
  const exercise = getExerciseById(summary.exerciseId);
  const [saveState, setSaveState] = useState<SaveState>(planId ? 'saving' : 'idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [next, setNext] = useState<TodayItem | null>(null);

  const save = useCallback(async () => {
    if (!planId) return;
    setSaveState('saving');
    const { error } = await saveSession({
      plan_id: planId,
      local_date: localDateString(),
      reps_completed: summary.repsCompleted,
      sets_completed: summary.setsCompleted,
      target_sets: summary.targetSets,
      target_reps: summary.targetReps,
      duration_seconds: summary.durationSeconds,
      avg_rom_degrees: summary.avgRomDeg,
      completed: summary.completed,
      summary: {
        rom_per_rep: summary.romPerRep,
        peak_rom_degrees: summary.peakRomDeg,
        accel_hz: summary.accelHz,
        gyro_hz: summary.gyroHz,
        requested_hz: summary.requestedHz,
        pauses: summary.pauses,
        exercise_slug: summary.exerciseId,
      },
    });
    if (error) {
      setSaveError(error);
      setSaveState('failed');
      return;
    }
    setSaveState('saved');
    const today = await getToday();
    setNext(today.data?.exercises.find((e) => !e.done) ?? null);
  }, [planId, summary]);

  useEffect(() => {
    save();
  }, [save]);

  const total = summary.targetSets * summary.targetReps;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <CheckBadge color={summary.completed ? exercise?.accentColor ?? colors.primary : colors.celebrate} />
        <Text style={styles.title}>{summary.completed ? 'Well done!' : 'Good effort!'}</Text>
        <Text style={styles.subtitle}>
          {summary.completed
            ? `You finished ${exercise?.title ?? 'this exercise'}.`
            : `You did part of ${exercise?.title ?? 'this exercise'}. That still counts.`}
        </Text>

        <View style={styles.grid}>
          <Stat label="Reps" value={`${summary.repsCompleted}/${total}`} />
          <Stat label="Sets" value={`${summary.setsCompleted}/${summary.targetSets}`} />
          <Stat label="Time" value={formatDuration(summary.durationSeconds)} />
          <Stat
            label={exercise?.sensorMode === 'rotation' ? 'Circles' : 'Avg range'}
            value={exercise?.sensorMode === 'rotation' ? String(summary.repsCompleted) : summary.avgRomDeg !== null ? `${summary.avgRomDeg}°` : '—'}
          />
        </View>
        {summary.peakRomDeg !== null && <Text style={styles.caption}>Best rep: {summary.peakRomDeg}° of movement</Text>}

        {planId ? (
          <View style={styles.saveRow}>
            {saveState === 'saving' && (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.caption}>Saving to your record…</Text>
              </>
            )}
            {saveState === 'saved' && <Text style={[styles.caption, { color: colors.motionSuccess }]}>✓ Saved. Your care team can see this session.</Text>}
            {saveState === 'failed' && <Text style={[styles.caption, { color: colors.danger }]}>Not saved: {saveError}</Text>}
          </View>
        ) : (
          <Text style={styles.caption}>Practice run — not saved to your program.</Text>
        )}
      </ScrollView>

      <View style={styles.buttons}>
        {saveState === 'failed' && <BigButton label="Try Saving Again" onPress={save} />}
        {next && (
          <BigButton
            label={`Next: ${next.exercise.name}`}
            accentColor={colors.action}
            onPress={() =>
              navigation.replace('Exercise', { exerciseId: next.exercise.slug, planId: next.plan_id, sets: next.sets, reps: next.reps })
            }
          />
        )}
        <BigButton
          label={planId ? 'Back to Today' : 'Back to Exercises'}
          variant={next ? 'outline' : 'primary'}
          onPress={() => (planId ? navigation.popToTop() : navigation.goBack())}
        />
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', padding: spacing.lg },
  title: { ...type.display, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md },
  subtitle: { ...type.bodyLarge, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg, justifyContent: 'center' },
  stat: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { ...type.h1, color: colors.textPrimary },
  statLabel: { ...type.caption, color: colors.textSecondary },
  caption: { ...type.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  saveRow: { alignItems: 'center', marginTop: spacing.md, gap: spacing.xs },
  buttons: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.sm },
});
