import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTheme, Spacing } from '@theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/**
 * The one generic card surface — `C.card` fill, `Spacing.radius.lg` (14, the
 * app's existing plurality choice) corners, a hairline border. Reach for this
 * for any plain content container; a card that's deliberately custom-branded
 * (a gradient banner, an always-dark hero) styles itself instead.
 */
export function Card({ children, style }: CardProps) {
  const C = useTheme();
  return <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.radius.lg,
    borderWidth: 0.5,
    padding: Spacing.lg,
  },
});
