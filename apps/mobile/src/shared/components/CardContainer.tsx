import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTheme } from '@theme';
import { Spacing } from '@theme';

interface CardContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function CardContainer({ children, style, onPress }: CardContainerProps) {
  const C = useTheme();

  const cardStyle = [
    styles.card,
    { backgroundColor: C.surface, borderColor: C.border },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.radius.lg,
    borderWidth:  0.5,
    padding:      Spacing.xl,
  },
  pressed: { opacity: 0.85 },
});
