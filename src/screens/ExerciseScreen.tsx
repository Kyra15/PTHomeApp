import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View, ScrollView } from 'react-native';
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
import { mixColor } from '../utils/color';
import { colors, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercise'>;

export function ExerciseScreen({ route, navigation }: Props) {
  const exercise = getExerciseById(route.params.exerciseId);

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={type.h2}>We couldn&apos;t find that exercise.</Text>
          <View style={{ height: spacing.lg }} />
          <BigButton label="Back to Exercises" onPress={() => navigation.replace('Home')} />
        </View>
      </SafeAreaView>
    );
  }

  return <ExerciseSession exercise={exercise} navigation={navigation} />;
}

function activeInstruction(exercise: Exercise, state: EngineState): string {
  if (exercise.sensorMode === 'rotation') return 'Keep circling slowly and steadily.';
  return state.leg === 'inbound' ? 'Now lower it slowly back down.' : 'Raise it slowly, like the picture.';
}

function activeBackgroundColor(exercise: Exercise, state: EngineState): string {
  if (exercise.sensorMode === 'rotation') {
    return mixColor(colors.motionRest, colors.motionSuccess, state.progress);
  }
  if (state.leg === 'inbound') {
    return mixColor(colors.motionSuccess, colors.motionRest, state.progress);
  }
  return mixColor(colors.motionRest, colors.motionMoving, state.progress);
}

function ExerciseSession({
  exercise,
  navigation,
}: {
  exercise: Exercise;
  navigation: Props['navigation'];
}) {
  useKeepAwake();
  const { state, start } = useExerciseEngine(exercise);

  useEffect(() => {
    if (state.phase !== 'finished') return;
    const timer = setTimeout(() => {
      navigation.replace('Complete', { exerciseId: exercise.id, reps: state.reps });
    }, 1700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const confirmStop = () => {
    Alert.alert('End this exercise?', 'Your progress on this exercise will not be saved.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End Exercise', style: 'destructive', onPress: () => navigation.replace('Home') },
    ]);
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
            This exercise needs a real iPhone&apos;s motion sensors to track your movement. It
            can&apos;t be tried in a simulator, and it looks like the sensors aren&apos;t
            available on this device right now.
          </Text>
          <View style={{ height: spacing.xl }} />
          <BigButton label="Back to Exercises" onPress={() => navigation.replace('Home')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (state.phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={[type.display, { color: colors.textPrimary }]}>{exercise.title}</Text>
          <View style={styles.diagramWrap}>
            <MotionDiagram kind={exercise.diagram} angleDeg={0} accentColor={exercise.accentColor} />
          </View>
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
          <View style={{ height: spacing.lg }} />
          <BigButton label="Start Exercise" onPress={start} accentColor={exercise.accentColor} />
          <View style={{ height: spacing.sm }} />
          <BigButton label="Back" variant="outline" onPress={() => navigation.replace('Home')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (state.phase === 'calibrating') {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.textPrimary }]}>
        <View style={styles.centered}>
          <Text style={[type.h1, styles.onDark]}>Hold Still</Text>
          <View style={{ height: spacing.md }} />
          <MotionDiagram kind={exercise.diagram} angleDeg={0} accentColor={colors.textOnDark} />
          <View style={{ height: spacing.md }} />
          <Text style={[type.giant, styles.onDark]}>{state.calibrationCountdown}</Text>
          <Text style={[type.body, styles.onDark]}>Finding your starting position…</Text>
        </View>
      </View>
    );
  }

  // 'active' or 'finished'
  const bg = state.phase === 'finished' ? colors.celebrate : activeBackgroundColor(exercise, state);

  return (
    <View style={[styles.fullScreen, { backgroundColor: bg }]}>
      <FlashOverlay flash={state.flash} />
      <SafeAreaView style={styles.fullScreen} edges={['top', 'bottom']}>
        <View style={styles.activeTop}>
          <Text style={styles.repCountText}>
            {Math.min(state.reps, exercise.targetReps)} of {exercise.targetReps} reps
          </Text>
          <RepProgressDots total={exercise.targetReps} completed={state.reps} accentColor={colors.textOnDark} />
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
              />
              <View style={{ height: spacing.md }} />
              <Text style={[type.h2, styles.onDark, { textAlign: 'center' }]}>
                {activeInstruction(exercise, state)}
              </Text>
              {state.tooFastNotice && (
                <View style={styles.noticeBadge}>
                  <Text style={styles.noticeText}>Slow and steady wins — ease up a little</Text>
                </View>
              )}
            </>
          )}
        </View>

        {state.phase === 'active' && (
          <View style={styles.activeBottom}>
            <BigButton
              label="Stop"
              variant="outline"
              onPress={confirmStop}
              style={styles.stopButton}
              textColor={colors.textOnDark}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullScreen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centeredScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  introContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  diagramWrap: {
    marginVertical: spacing.md,
  },
  instructionsBox: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  instructionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  instructionBadgeText: {
    color: colors.textOnDark,
    fontWeight: '800',
    fontSize: 18,
  },
  instructionText: {
    ...type.body,
    color: colors.textPrimary,
    flex: 1,
  },
  onDark: {
    color: colors.textOnDark,
  },
  activeTop: {
    alignItems: 'center',
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  repCountText: {
    ...type.h2,
    color: colors.textOnDark,
  },
  activeBottom: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  stopButton: {
    borderColor: colors.textOnDark,
  },
  noticeBadge: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  noticeText: {
    ...type.caption,
    color: colors.textOnDark,
    fontWeight: '700',
  },
});
