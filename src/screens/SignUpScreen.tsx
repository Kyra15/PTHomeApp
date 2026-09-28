import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { BigButton } from '../components/BigButton';
import { BigInput } from '../components/BigInput';
import { colors, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && !busy;

  async function submit() {
    setBusy(true);
    setMessage(null);
    const { error } = await signUp(name, email, password);
    setBusy(false);
    if (error) setMessage(error); // on success the navigator switches to the dashboard automatically
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create Account</Text>
          <BigInput label="Your name" value={name} onChangeText={setName} textContentType="name" autoComplete="name" />
          <BigInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
          />
          <BigInput
            label="Password (6+ characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
          />
          {message ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          ) : null}
          <BigButton label={busy ? 'Creating…' : 'Create Account'} onPress={submit} disabled={!canSubmit} />
          <BigButton
            label="I already have an account"
            variant="outline"
            onPress={() => navigation.replace('SignIn')}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  error: { ...type.body, color: colors.danger, marginBottom: spacing.md },
});
