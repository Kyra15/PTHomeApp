import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { EXERCISES } from '../data/exercises';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Home PT Coach</Text>
        <Text style={styles.subtitle}>Tap an exercise to begin.</Text>

        <View style={styles.list}>
          {EXERCISES.map((exercise) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              accessibilityLabel={`${exercise.title}. ${exercise.shortDescription}`}
              onPress={() => navigation.navigate('Exercise', { exerciseId: exercise.id })}
              style={({ pressed }) => [
                styles.card,
                { borderLeftColor: exercise.accentColor, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.cardTitle}>{exercise.title}</Text>
              <Text style={styles.cardSubtitle}>{exercise.shortDescription}</Text>
              <Text style={styles.cardMeta}>{exercise.targetReps} reps</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Always follow the guidance your physical therapist gave you, and stop right away if
            anything hurts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...type.display,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...type.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderLeftWidth: 10,
    padding: spacing.lg,
    minHeight: 120,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: {
    ...type.h2,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardSubtitle: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardMeta: {
    ...type.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
  },
  footerText: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
