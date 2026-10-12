import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { BigButton } from '../components/BigButton';
import { BigInput } from '../components/BigInput';
import { acceptByCode, acceptInvitation, declineInvitation, getMyInvitations } from '../lib/api';
import type { PendingInvitation } from '../lib/api';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Connect'>;

/** "Connect with a doctor": accept an in-app invitation, or type the code from the invite email. */
export function ConnectScreen({ navigation, route }: Props) {
  const [invites, setInvites] = useState<PendingInvitation[] | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [code, setCode] = useState(route.params?.code ?? '');
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getMyInvitations();
    setInvites(data?.invitations ?? []);
    setEmailConfirmed(data?.email_confirmed ?? true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A tapped invite link (kinetic://invite/ABCD1234) can arrive while this screen is already open.
  useEffect(() => {
    if (route.params?.code) setCode(route.params.code);
  }, [route.params?.code]);

  function done(name: string) {
    setMessage({ text: `You're now connected with ${name}.`, good: true });
    setCode('');
    load();
  }

  async function submitCode() {
    setBusy(true);
    setMessage(null);
    const { data, error } = await acceptByCode(code.trim());
    setBusy(false);
    if (error || !data) return setMessage({ text: error ?? 'Something went wrong.', good: false });
    done(data.therapist_name);
  }

  async function accept(inv: PendingInvitation) {
    setBusy(true);
    setMessage(null);
    const { data, error } = await acceptInvitation(inv.id);
    setBusy(false);
    if (error || !data) return setMessage({ text: error ?? 'Something went wrong.', good: false });
    done(data.therapist_name);
  }

  async function decline(inv: PendingInvitation) {
    setBusy(true);
    const { error } = await declineInvitation(inv.id);
    setBusy(false);
    if (error) return setMessage({ text: error, good: false });
    load();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Connect with a doctor</Text>

          {!emailConfirmed ? (
            <View style={[styles.card, styles.warn]}>
              <Text style={styles.cardTitle}>Confirm your email first</Text>
              <Text style={styles.body}>
                Open the confirmation email we sent you and tap the link. Then come back here to accept an
                invitation.
              </Text>
            </View>
          ) : null}

          {message ? (
            <View style={[styles.card, message.good ? styles.good : styles.warn]} accessibilityLiveRegion="polite">
              <Text style={styles.body}>{message.text}</Text>
            </View>
          ) : null}

          <Text style={styles.section}>Invitations for you</Text>
          {invites === null ? <ActivityIndicator color={colors.primary} /> : null}
          {invites && invites.length === 0 ? (
            <Text style={styles.muted}>No pending invitations right now.</Text>
          ) : null}
          {invites?.map((inv) => (
            <View key={inv.id} style={styles.card}>
              <Text style={styles.cardTitle}>{inv.therapist_name}</Text>
              <Text style={styles.body}>invited you to connect and guide your home exercise program.</Text>
              <View style={styles.row}>
                <BigButton label="Accept" onPress={() => accept(inv)} disabled={busy || !emailConfirmed} style={styles.flex} />
                <BigButton label="Decline" variant="outline" onPress={() => decline(inv)} disabled={busy} style={styles.flex} />
              </View>
            </View>
          ))}

          <Text style={styles.section}>Have an invite code?</Text>
          <BigInput
            label="Invite code"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCD-EFGH"
            maxLength={9}
          />
          <BigButton label="Connect" onPress={submitCode} disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 8 || !emailConfirmed} />
          <View style={{ height: spacing.md }} />
          <BigButton label="Back" variant="outline" onPress={() => navigation.goBack()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.md },
  section: { ...type.h2, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  muted: { ...type.body, color: colors.textSecondary },
  body: { ...type.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTitle: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  good: { borderColor: colors.motionSuccess },
  warn: { borderColor: colors.celebrate },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});
