import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { BODY_AREAS, EXERCISES, searchExercises } from '../data/exercises';
import { colors, minTouchTarget, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Patient-side exercise library (F11): every exercise the app can track, searchable and filterable by
 * body area. Tapping one opens the pre-exercise screen as a practice run (not saved to the program).
 */
export function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const results = useMemo(() => searchExercises(query, area), [query, area]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Exercise Library</Text>
        </View>
        <Text style={styles.subtitle}>{EXERCISES.length} exercises. Tap one to practice.</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search, e.g. knee or balance"
          placeholderTextColor={colors.textSecondary}
          style={styles.search}
          accessibilityLabel="Search exercises"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[null, ...BODY_AREAS].map((a) => {
            const on = area === a;
            return (
              <Pressable
                key={a ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setArea(a)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{a ?? 'All'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.cardTitle}>No exercises match</Text>
            <Text style={styles.cardSubtitle}>Try a different word, or tap “All”.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {results.map((exercise) => (
              <Pressable
                key={exercise.id}
                accessibilityRole="button"
                accessibilityLabel={`${exercise.title}, ${exercise.bodyArea}. ${exercise.shortDescription}`}
                onPress={() => navigation.navigate('Exercise', { exerciseId: exercise.id })}
                style={({ pressed }) => [styles.card, { borderLeftColor: exercise.accentColor, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.cardMeta}>
                  {exercise.bodyArea.toUpperCase()} · {exercise.difficulty}
                </Text>
                <Text style={styles.cardTitle}>{exercise.title}</Text>
                <Text style={styles.cardSubtitle}>{exercise.shortDescription}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Only do exercises your physical therapist has approved for you, and stop right away if anything hurts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  back: { width: 48, height: 56, justifyContent: 'center' },
  backChevron: { fontSize: 48, lineHeight: 52, color: colors.textPrimary, fontWeight: '600' },
  title: { ...type.h1, color: colors.textPrimary, flex: 1 },
  subtitle: { ...type.body, color: colors.textSecondary, marginBottom: spacing.md },
  search: {
    ...type.body,
    minHeight: minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  chips: { gap: spacing.xs, paddingVertical: spacing.md },
  chip: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.caption, fontWeight: '700', color: colors.textPrimary },
  chipTextOn: { color: colors.textOnDark },
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderLeftWidth: 10,
    padding: spacing.md,
    minHeight: 110,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardMeta: { ...type.caption, fontSize: 15, color: colors.textSecondary, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { ...type.h2, color: colors.textPrimary, marginVertical: 4 },
  cardSubtitle: { ...type.body, color: colors.textSecondary },
  empty: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border },
  footerNote: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radii.md },
  footerText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
