import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, minTouchTarget, radii, spacing, type } from '../theme/theme';

type Variant = 'primary' | 'secondary' | 'outline';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accentColor?: string;
  style?: ViewStyle;
  /** Extra short line rendered under the main label, e.g. a hint. */
  subLabel?: string;
  /** Override the computed text color — useful for outline buttons on a colored background. */
  textColor?: string;
}

export function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accentColor,
  style,
  subLabel,
  textColor: textColorOverride,
}: Props) {
  const bg = disabled
    ? colors.disabled
    : variant === 'primary'
    ? accentColor ?? colors.primary
    : variant === 'secondary'
    ? colors.surfaceAlt
    : 'transparent';

  const textColor = textColorOverride ?? (variant === 'primary' ? colors.textOnDark : colors.textPrimary);
  const borderColor = variant === 'outline' ? (accentColor ?? colors.primary) : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, opacity: pressed ? 0.85 : 1 },
        variant === 'outline' && styles.outlineBorder,
        style,
      ]}
    >
      <View>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {subLabel ? <Text style={[styles.subLabel, { color: textColor }]}>{subLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget + 16,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  outlineBorder: {
    borderWidth: 3,
  },
  label: {
    ...type.button,
    textAlign: 'center',
  },
  subLabel: {
    ...type.caption,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.85,
  },
});
