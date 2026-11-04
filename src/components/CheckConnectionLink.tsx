import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { runConnectionCheck } from '../utils/connectionCheck';
import { colors, spacing, type } from '../theme/theme';

/** "Check connection" — tests Supabase + the backend and explains any problem (wrong address, paused project…). */
export function CheckConnectionLink() {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Check connection"
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        await runConnectionCheck();
        setBusy(false);
      }}
      hitSlop={12}
      style={styles.wrap}
    >
      <Text style={styles.text}>{busy ? 'Checking connection…' : 'Having trouble? Check connection'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.md },
  text: { ...type.body, color: colors.textSecondary, textDecorationLine: 'underline' },
});
