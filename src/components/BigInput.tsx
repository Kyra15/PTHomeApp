import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, minTouchTarget, radii, spacing, type } from '../theme/theme';

interface Props extends TextInputProps {
  label: string;
}

/** Large, high-contrast text field that matches the rest of the app's accessibility rules. */
export function BigInput({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...type.body, color: colors.textPrimary, marginBottom: spacing.xs },
  input: {
    ...type.body,
    minHeight: minTouchTarget,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
});
