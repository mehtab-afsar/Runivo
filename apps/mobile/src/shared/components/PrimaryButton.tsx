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
   * danger  — red outline, transparent fill, red text (destructive intent —
   *           visually distinct from `accent` on purpose; same hue as the brand
   *           accent since there's no separate "danger red," so the shape
   *           carries the distinction instead of the color)
   */
  variant?: 'accent' | 'dark' | 'surface' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHT = { sm: 40, md: 52, lg: 56 } as const;
const FONT_SIZE = { sm: 13, md: 15, lg: 16 } as const;
// iOS HIG minimum tap target is 44x44pt. `sm` renders at 40 to keep the visual
// density of compact/inline CTAs — hitSlop expands the tappable area to 44
// without changing how the button looks. md/lg already clear 44 on their own.
const HIT_SLOP = { sm: { top: 2, bottom: 2, left: 2, right: 2 }, md: undefined, lg: undefined } as const;

export function PrimaryButton({
  label, onPress, disabled, loading,
  variant = 'accent', size = 'md', fullWidth, icon, style,
}: PrimaryButtonProps) {
  const C = useTheme();

  const bg = disabled
    ? C.surface
    : variant === 'accent' ? C.accent
    : variant === 'dark' ? C.alwaysDark
    : variant === 'ghost' || variant === 'danger' ? 'transparent'
    : C.surface;

  const textColor = disabled
    ? C.t3
    : variant === 'surface' ? C.t1
    : variant === 'ghost' ? C.accent
    : variant === 'danger' ? C.red
    : C.alwaysLight;

  const borderStyle = variant === 'surface'
    ? { borderWidth: 0.5, borderColor: C.border }
    : variant === 'danger' && !disabled
    ? { borderWidth: 1.5, borderColor: C.red }
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
      hitSlop={HIT_SLOP[size]}
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
  btn:       { borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  fullWidth: { alignSelf: 'stretch' },
  pressed:   { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
