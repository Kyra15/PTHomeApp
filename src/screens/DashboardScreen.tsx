import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { BigButton } from '../components/BigButton';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

/** Empty dashboard for task 1.5. The real dashboard (today's exercises, streak) is task 2.1. */
export function DashboardScreen({ navigation }: Props) {
  const { firstName, session, signOut } = useAuth();
  const greeting = firstName ? `Hello, ${firstName}` : 'Hello';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>{greeting}</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No exercises yet</Text>
          <Text style={styles.emptyBody}>
            Your care team hasn't assigned a program to you yet. Once they do, today's exercises
            will show up here.
          </Text>
        </View>
        <Text style={styles.caption}>Signed in as {session?.user.email}</Text>
      </View>
      <View style={styles.buttons}>
        <BigButton label="Try the demo exercises" variant="secondary" onPress={() => navigation.navigate('Home')} />
        <BigButton label="Sign Out" variant="outline" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'space-between' },
  content: { flex: 1 },
  title: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  empty: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border },
  emptyTitle: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyBody: { ...type.body, color: colors.textSecondary },
  caption: { ...type.caption, color: colors.textSecondary, marginTop: spacing.lg },
  buttons: { gap: spacing.md },
});
