import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';
import { FlashKind } from '../hooks/useExerciseEngine';

interface Props {
  flash: FlashKind;
}

const FLASH_COLOR: Record<Exclude<FlashKind, null>, string> = {
  target: colors.motionFlash,
  rep: colors.motionFlash,
  complete: colors.celebrate,
};

export function FlashOverlay({ flash }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!flash) return;
    opacity.setValue(0.55);
    Animated.timing(opacity, {
      toValue: 0,
      duration: flash === 'complete' ? 1200 : 500,
      useNativeDriver: true,
    }).start();
  }, [flash, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: flash ? FLASH_COLOR[flash] : 'transparent', opacity },
      ]}
    />
  );
}
