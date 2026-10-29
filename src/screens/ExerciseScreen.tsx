import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Exercise } from '../types/exercise';
import { getExerciseById } from '../data/exercises';
import { useExerciseEngine, EngineState } from '../hooks/useExerciseEngine';
import { MotionDiagram } from '../components/MotionDiagram';
import { BigButton } from '../components/BigButton';
import { RepProgressDots } from '../components/RepProgressDots';
import { FlashOverlay } from '../components/FlashOverlay';
import { Sparkline } from '../components/Sparkline';
import { Chip } from '../components/Chip';
import { mixColor } from '../utils/color';
import { stopSpeaking } from '../utils/speech';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercise'>;

export function ExerciseScreen({ route, navigation }: Props) {
  const { exerciseId, planId, sets, reps } = route.params;
  const exercise = getExerciseById(exerciseId);

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={[type.h2, { textAlign: 'center' }]}>
            This exercise isn&apos;t in this version of the app yet. Please update the app.
          </Text>
          <View style={{ height: spacing.lg }} />
          <BigButton label="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ExerciseSession
      exercise={exercise}
      planId={planId}
      sets={sets ?? (planId ? exercise.defaultSets : 1)}
      reps={reps ?? exercise.targetReps}
      navigation={navigation}
    />
  );
}

function activeInstruction(exercise: Exercise, state: EngineState): string {
  if (exercise.sensorMode === 'rotation') return 'Keep moving slowly and steadily.';
  return state.leg === 'inbound' ? 'Now bring it back slowly.' : 'Move slowly, like the picture.';
}

function activeBackgroundColor(exercise: Exercise, state: EngineState): string {
  if (exercise.sensorMode === 'rotation') return mixColor(colors.motionRest, colors.motionSuccess, state.progress);
  if (state.leg === 'inbound') return mixColor(colors.motionSuccess, colors.motionRest, state.progress);
  return mixColor(colors.motionRest, colors.motionMoving, state.progress);
}

/** Looping preview pose for the pre-exercise "demo" card (stand-in until real demo videos exist). */
function useDemoAngle(exercise: Exercise, playing: boolean): number {
  const [angle, setAngle] = useState(0);
  const t = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      t.current += 0.05;
      if (exercise.sensorMode === 'rotation') setAngle((a) => (a + 6) % 360);
      else setAngle(((1 - Math.cos(t.current * 2.2)) / 2) * (exercise.targetAngleDeg ?? 60));
    }, 50);
    return () => clearInterval(id);
  }, [playing, exercise]);
  return playing ? angle : 0;
}

function ExerciseSession({
  exercise,
  planId,
  sets,
  reps,
  navigation,
}: {
  exercise: Exercise;
  planId?: string;
  sets: number;
  reps: number;
  navigation: Props['navigation'];
}) {
  useKeepAwake();
  const { state, start, pause, resume, skipRest, endEarly, getSummary } = useExerciseEngine(exercise, { sets, reps });
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoAngle = useDemoAngle(exercise, demoPlaying);
  const dialTarget = exercise.sensorMode === 'tilt' ? exercise.targetAngleDeg : undefined;

  useEffect(() => {
    if (state.phase !== 'finished') return;
    const timer = setTimeout(() => navigation.replace('Complete', { summary: getSummary(), planId }), 1700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const confirmEnd = () => {
    const wasActive = state.phase === 'active';
    if (wasActive) pause('user');
    Alert.alert(
      'End this exercise?',
      state.totalReps > 0
        ? `You've done ${state.totalReps} ${state.totalReps === 1 ? 'rep' : 'reps'}. We'll save what you've done so far.`
        : "You haven't finished any reps yet, so nothing will be saved.",
      [
        { text: 'Keep Going', style: 'cancel', onPress: () => wasActive && resume() },
        {
          text: 'End Exercise',
          style: 'destructive',
          onPress: () => {
            stopSpeaking();
            const summary = endEarly();
            if (summary.repsCompleted > 0) navigation.replace('Complete', { summary, planId });
            else navigation.goBack();
          },
        },
      ],
    );
  };

  if (state.phase === 'checking-sensors') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <View style={{ height: spacing.md }} />
          <Text style={type.body}>Getting the sensors ready…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'sensors-unavailable') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.centeredScroll}>
          <Text style={type.h1}>Motion Sensors Needed</Text>
          <View style={{ height: spacing.md }} />
          <Text style={[type.body, { textAlign: 'center' }]}>
            This exercise needs a real iPhone&apos;s motion sensors to track your movement. It can&apos;t be tried in a
            simulator, and it looks like the sensors aren&apos;t available on this device right now.
          </Text>
          <View style={{ height: spacing.xl }} />
          <BigButton label="Go Back" onPress={() => navigation.goBack()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- Task 2.3: pre-exercise instructions (mockup p3) ----------
  if (state.phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {exercise.title}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.introContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={demoPlaying ? 'Stop the demo' : 'Play a demo of this exercise'}
            onPress={() => setDemoPlaying((p) => !p)}
            style={[styles.demoCard, { backgroundColor: exercise.accentColor }]}
          >
            <MotionDiagram
              kind={exercise.diagram}
              angleDeg={demoAngle}
              accentColor={colors.textOnDark}
              size={220}
              targetDeg={dialTarget}
            />
            {!demoPlaying && (
              <View style={styles.playBadge}>
                <Text style={[styles.playIcon, { color: exercise.accentColor }]}>▶</Text>
              </View>
            )}
            <View style={styles.demoLabel}>
              <Text style={styles.demoLabelText}>{demoPlaying ? 'Tap to stop' : 'Tap for demo'}</Text>
            </View>
          </Pressable>

          <View style={styles.chips}>
            <Chip label={sets > 1 ? `${sets} sets × ${reps} reps` : `${reps} reps`} />
            <Chip label={exercise.bodyArea} tone="action" />
            <Chip label={`~${Math.max(1, Math.round((exercise.estMinutes * sets) / Math.max(1, exercise.defaultSets)))} min`} />
          </View>

          <Text style={styles.sectionTitle}>How to do it</Text>
          <View style={styles.instructionsBox}>
            {exercise.instructions.map((step, i) => (
              <View key={i} style={styles.instructionRow}>
                <View style={[styles.instructionBadge, { backgroundColor: exercise.accentColor }]}>
                  <Text style={styles.instructionBadgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={styles.tipBox} accessible accessibilityLabel={`Positioning tip. ${exercise.positioningTip}`}>
            <Text style={styles.tipIcon}>📱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Positioning tip</Text>
              <Text style={styles.tipBody}>{exercise.positioningTip}</Text>
              {exercise.equipment !== 'none' && <Text style={styles.tipBody}>You&apos;ll need: {exercise.equipment}.</Text>}
            </View>
          </View>
          <Text style={styles.safety}>Stop right away if anything hurts, and follow your therapist&apos;s guidance.</Text>
        </ScrollView>
        <View style={styles.footer}>
          <BigButton
            label="▶  Start Exercise"
            onPress={() => {
              setDemoPlaying(false);
              start();
            }}
            accentColor={colors.action}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'calibrating') {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.textPrimary }]}>
        <View style={styles.centered}>
          <Text style={[type.h1, styles.onDark]}>Hold Still</Text>
          <View style={{ height: spacing.md }} />
          <MotionDiagram kind={exercise.diagram} angleDeg={0} accentColor={colors.textOnDark} targetDeg={dialTarget} />
          <View style={{ height: spacing.md }} />
          <Text style={[type.giant, styles.onDark]}>{state.calibrationCountdown}</Text>
          <Text style={[type.body, styles.onDark, { textAlign: 'center' }]}>{exercise.positioningTip}</Text>
        </View>
      </View>
    );
  }

  if (state.phase === 'paused') {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.textPrimary }]}>
        <SafeAreaView style={styles.fullScreen} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <Text style={[type.display, styles.onDark]}>Paused</Text>
            <View style={{ height: spacing.sm }} />
            <Text style={[type.body, styles.onDark, { textAlign: 'center' }]}>
              {state.pausedReason === 'background'
                ? 'We paused because you left the app. Your reps are saved.'
                : 'Take your time. Your reps are saved.'}
            </Text>
            <View style={{ height: spacing.md }} />
            <Text style={[type.h2, styles.onDark]}>
              {sets > 1 ? `Set ${state.set} of ${sets} · ` : ''}
              {state.reps} of {reps} reps
            </Text>
          </View>
          <View style={styles.pausedButtons}>
            <BigButton label="Resume" onPress={resume} accentColor={colors.motionSuccess} />
            <BigButton
              label="End Exercise"
              variant="outline"
              onPress={confirmEnd}
              style={styles.outlineOnDark}
              textColor={colors.textOnDark}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (state.phase === 'rest') {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.motionSuccess }]}>
        <SafeAreaView style={styles.fullScreen} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <Text style={[type.h1, styles.onDark, { textAlign: 'center' }]}>
              Set {state.set} of {sets} done!
            </Text>
            <Text style={[type.body, styles.onDark]}>Rest and breathe.</Text>
            <Text style={[type.giant, styles.onDark]} accessibilityLabel={`${state.restCountdown} seconds of rest left`}>
              {state.restCountdown}
            </Text>
            <Text style={[type.body, styles.onDark]}>Next set starts automatically.</Text>
          </View>
          <View style={styles.pausedButtons}>
            <BigButton label="Start Next Set Now" onPress={skipRest} variant="secondary" />
            <BigButton
              label="End Exercise"
              variant="outline"
              onPress={confirmEnd}
              style={styles.outlineOnDark}
              textColor={colors.textOnDark}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------- 'active' or 'finished' (mockup p4) ----------
  const bg = state.phase === 'finished' ? colors.celebrate : activeBackgroundColor(exercise, state);
  const repsShown = Math.min(state.reps, reps);

  return (
    <View style={[styles.fullScreen, { backgroundColor: bg }]}>
      <FlashOverlay flash={state.flash} />
      <SafeAreaView style={styles.fullScreen} edges={['top', 'bottom']}>
        <View style={styles.activeTopRow}>
          <View style={styles.setPill}>
            <Text style={styles.setPillText}>{sets > 1 ? `Set ${state.set} of ${sets}` : exercise.title}</Text>
          </View>
          {state.phase === 'active' && (
            <Pressable accessibilityRole="button" accessibilityLabel="End exercise" onPress={confirmEnd} style={styles.closeButton} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.activeTop}>
          <Text style={styles.repCountText} accessibilityLiveRegion="polite">
            {repsShown} of {reps} reps
          </Text>
          <RepProgressDots total={reps} completed={state.reps} accentColor={colors.textOnDark} />
        </View>

        <View style={styles.centered}>
          {state.phase === 'finished' ? (
            <>
              <Text style={[type.display, styles.onDark, { textAlign: 'center' }]}>Great Job!</Text>
              <Text style={[type.h2, styles.onDark, { textAlign: 'center' }]}>Exercise complete</Text>
            </>
          ) : (
            <>
              <MotionDiagram
                kind={exercise.diagram}
                angleDeg={state.diagramAngle}
                accentColor={colors.textOnDark}
                size={220}
                targetDeg={dialTarget}
              />
              <View style={{ height: spacing.sm }} />
              <Text style={[type.h2, styles.onDark, { textAlign: 'center' }]}>{activeInstruction(exercise, state)}</Text>
              {state.tooFastNotice && (
                <View style={styles.noticeBadge}>
                  <Text style={styles.noticeText}>Slow and steady wins — ease up a little</Text>
                </View>
              )}
            </>
          )}
        </View>

        {state.phase === 'active' && (
          <>
            <View style={styles.sensorCard} accessible accessibilityLabel="Live motion sensor readings">
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>MOTION</Text>
                <Text style={styles.sensorMeta}>
                  {state.accelHz ? `${state.accelHz} Hz` : '…'}
                  {state.lastRepRom !== null ? `  ·  Last rep ${state.lastRepRom}°` : ''}
                </Text>
              </View>
              <Sparkline values={state.traceAccel} width={300} height={34} color={colors.textOnDark} max={0.6} />
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>ROTATION</Text>
                <Text style={styles.sensorMeta}>{state.gyroHz ? `${state.gyroHz} Hz` : '…'}</Text>
              </View>
              <Sparkline values={state.traceGyro} width={300} height={34} color={colors.textOnDark} max={240} />
            </View>
            <View style={styles.activeBottom}>
              <BigButton
                label="❚❚  Pause"
                variant="outline"
                onPress={() => pause('user')}
                style={styles.outlineOnDark}
                textColor={colors.textOnDark}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fullScreen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  centeredScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
  backButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontSize: 48, lineHeight: 52, color: colors.textPrimary, fontWeight: '600' },
  headerTitle: { ...type.h1, color: colors.textPrimary, flex: 1 },
  introContent: { padding: spacing.lg, paddingTop: spacing.sm },
  demoCard: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    minHeight: 260,
  },
  playBadge: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 36, marginLeft: 6 },
  demoLabel: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  demoLabelText: { ...type.caption, color: colors.textOnDark, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  sectionTitle: { ...type.h2, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  instructionsBox: { width: '100%', gap: spacing.md },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  instructionBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  instructionBadgeText: { color: colors.textOnDark, fontWeight: '800', fontSize: 18 },
  instructionText: { ...type.body, color: colors.textPrimary, flex: 1 },
  tipBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  tipIcon: { fontSize: 28 },
  tipTitle: { ...type.bodyLarge, color: colors.textPrimary },
  tipBody: { ...type.body, color: colors.textSecondary, marginTop: 4 },
  safety: { ...type.caption, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, paddingTop: spacing.sm },
  onDark: { color: colors.textOnDark },
  activeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  setPill: { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  setPillText: { ...type.caption, color: colors.textOnDark, fontWeight: '800' },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 26, color: colors.textOnDark, fontWeight: '800' },
  activeTop: { alignItems: 'center', paddingTop: spacing.sm, gap: spacing.sm },
  repCountText: { ...type.h1, color: colors.textOnDark },
  sensorCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  sensorRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 4 },
  sensorLabel: { ...type.caption, fontSize: 15, color: colors.textOnDark, fontWeight: '800', letterSpacing: 1 },
  sensorMeta: { ...type.caption, fontSize: 15, color: colors.textOnDark, fontWeight: '700' },
  activeBottom: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  outlineOnDark: { borderColor: colors.textOnDark },
  pausedButtons: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  noticeBadge: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  noticeText: { ...type.caption, color: colors.textOnDark, fontWeight: '700' },
});
