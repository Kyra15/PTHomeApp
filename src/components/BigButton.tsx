import React, { useEffect, useState } from 'react';
import { NativeSyntheticEvent, Pressable, StyleSheet, Text, TextLayoutEventData, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
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
  /** Lucide icon shown before the label (decorative — the label is still read by VoiceOver). */
  icon?: LucideIcon;
  /** Fill the icon's shape too (good for solid Play / Pause glyphs). */
  iconFilled?: boolean;
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
  icon: Icon,
  iconFilled = false,
}: Props) {
  // A wrapped <Text> keeps the full row width, so icon + label won't centre as a block. Measure the
  // wrapped lines once and shrink the label to the widest one. Reset when the label changes.
  const [fitWidth, setFitWidth] = useState<number | undefined>(undefined);
  useEffect(() => setFitWidth(undefined), [label]);
  const onTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = e.nativeEvent.lines;
    if (!Icon || fitWidth !== undefined || lines.length < 2) return;
    setFitWidth(Math.ceil(Math.max(...lines.map((l) => l.width))) + 1);
  };

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
      <View style={styles.content}>
        <View style={styles.labelRow}>
          {Icon ? (
            <Icon
              size={26}
              color={textColor}
              strokeWidth={2.5}
              fill={iconFilled ? textColor : 'none'}
              style={styles.icon}
              accessible={false}
            />
          ) : null}
          {/* With an icon, the label wraps beside it (left-aligned, shrink-wrapped by onTextLayout) so
              icon + text stay one centred block instead of the icon drifting off when a long label wraps. */}
          <Text
            onTextLayout={onTextLayout}
            style={[styles.label, Icon ? styles.labelWithIcon : null, fitWidth ? { width: fitWidth } : null, { color: textColor }]}
          >
            {label}
          </Text>
        </View>
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
  content: { maxWidth: '100%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, maxWidth: '100%' },
  icon: { flexShrink: 0 },
  labelWithIcon: { flexShrink: 1, textAlign: 'left' },
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
