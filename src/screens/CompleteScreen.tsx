import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getExerciseById } from '../data/exercises';
import { BigButton } from '../components/BigButton';
import { colors, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Complete'>;

function CheckBadge({ color }: { color: string }) {
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Circle cx={70} cy={70} r={64} fill={color} />
      <Path
        d="M42 72 L62 92 L98 48"
        stroke={colors.textOnDark}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CompleteScreen({ route, navigation }: Props) {
  const { exerciseId, reps } = route.params;
  const exercise = getExerciseById(exerciseId);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <CheckBadge color={exercise?.accentColor ?? colors.primary} />
        <View style={{ height: spacing.lg }} />
        <Text style={styles.title}>Well done!</Text>
        <Text style={styles.subtitle}>
          You completed {reps} {reps === 1 ? 'rep' : 'reps'} of{'\n'}
          {exercise?.title ?? 'this exercise'}.
        </Text>

        <View style={{ height: spacing.xl }} />

        {exercise && (
          <BigButton
            label="Do It Again"
            accentColor={exercise.accentColor}
            onPress={() => navigation.replace('Exercise', { exerciseId: exercise.id })}
          />
        )}
        <View style={{ height: spacing.sm }} />
        <BigButton label="Back to Exercises" variant="outline" onPress={() => navigation.replace('Home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    ...type.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...type.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
