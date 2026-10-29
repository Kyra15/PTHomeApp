import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, type } from '../theme/theme';

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'action' | 'success' }) {
  const bg = tone === 'action' ? colors.actionSoft : tone === 'success' ? colors.successSoft : colors.surfaceAlt;
  const fg = tone === 'action' ? colors.action : tone === 'success' ? colors.motionSuccess : colors.primaryDark;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 14 },
  text: { ...type.caption, fontWeight: '700' },
});
