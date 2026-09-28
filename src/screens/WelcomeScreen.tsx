import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { BigButton } from '../components/BigButton';
import { colors, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Kinetic</Text>
        <Text style={styles.subtitle}>
          Your home exercises, tracked gently and correctly — with your care team in the loop.
        </Text>
      </View>
      <View style={styles.buttons}>
        <BigButton label="Sign In" onPress={() => navigation.navigate('SignIn')} />
        <BigButton label="Create Account" variant="outline" onPress={() => navigation.navigate('SignUp')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center' },
  title: { ...type.display, color: colors.primary, marginBottom: spacing.md },
  subtitle: { ...type.bodyLarge, color: colors.textSecondary },
  buttons: { gap: spacing.md },
});
