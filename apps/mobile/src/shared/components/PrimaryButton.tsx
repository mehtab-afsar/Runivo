import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, Type } from '@theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * accent  — vermilion fill, white text (the one CTA on a screen)
   * dark    — always-dark fill, white text (bold secondary, e.g. "Start run")
   * surface — bordered neutral fill, ink text (tertiary)
   * ghost   — no fill, accent text (inline actions)
   * danger  — same fill as accent, reserved for destructive intent
   */
  variant?: 'accent' | 'dark' | 'surface' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHT = { sm: 40, md: 52, lg: 56 } as const;
const FONT_SIZE = { sm: 13, md: 15, lg: 16 } as const;

export function PrimaryButton({
  label, onPress, disabled, loading,
  variant = 'accent', size = 'md', fullWidth, icon, style,
}: PrimaryButtonProps) {
  const C = useTheme();

  const bg = disabled
    ? C.surface
    : variant === 'accent' || variant === 'danger' ? C.accent
    : variant === 'dark' ? C.alwaysDark
    : variant === 'ghost' ? 'transparent'
    : C.surface;

  const textColor = disabled
    ? C.t3
    : variant === 'surface' ? C.t1
    : variant === 'ghost' ? C.accent
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
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { height: HEIGHT[size], backgroundColor: bg },
        borderStyle,
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} />
        : <>
            {icon}
            <Text style={[Type.button, { color: textColor, fontSize: FONT_SIZE[size] }]}>
              {label}
            </Text>
          </>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn:       { borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  fullWidth: { alignSelf: 'stretch' },
  pressed:   { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
