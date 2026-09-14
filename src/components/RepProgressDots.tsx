import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/theme';

interface Props {
  total: number;
  completed: number;
  accentColor: string;
}

export function RepProgressDots({ total, completed, accentColor }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`${completed} of ${total} reps done`}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < completed ? accentColor : 'transparent',
              borderColor: i < completed ? accentColor : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
  },
});
