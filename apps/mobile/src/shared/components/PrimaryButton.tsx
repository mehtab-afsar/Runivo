import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@theme';
import { FontSize } from '@theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'accent' | 'surface' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHT = { sm: 40, md: 52, lg: 56 } as const;

export function PrimaryButton({
  label, onPress, disabled, loading,
  variant = 'accent', size = 'md', fullWidth, icon, style,
}: PrimaryButtonProps) {
  const C = useTheme();

  const bg = disabled
    ? C.surface
    : variant === 'accent' ? C.accent
    : variant === 'danger' ? C.red
    : C.surface;

  const textColor = disabled
    ? C.t3
    : variant === 'surface' ? C.black
    : C.alwaysLight;

  const borderStyle = variant === 'surface'
    ? { borderWidth: 0.5, borderColor: C.border }
    : {};

  function handlePress() {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.btn,
        { height: HEIGHT[size], backgroundColor: bg },
        borderStyle,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} />
        : <>
            {icon}
            <Text style={[styles.label, { color: textColor, fontSize: FontSize.callout }]}>
              {label}
            </Text>
          </>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn:       { borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  fullWidth: { alignSelf: 'stretch' },
  label:     { fontWeight: '600' },
});
