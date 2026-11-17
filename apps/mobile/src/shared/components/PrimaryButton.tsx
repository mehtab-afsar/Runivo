import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { useTheme, Type } from '@theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * dark        — ink fill, white text: the main action (final mock's buttons, forms)
   * accent      — brand green fill, white text
   * surface     — bordered neutral fill, ink text (secondary)
   * ghost       — no fill, accent text (inline actions)
   * danger      — red outline, red text (a destructive option among others)
   * destructive — red fill, white text (the confirming destructive button)
   */
  variant?: 'accent' | 'dark' | 'surface' | 'ghost' | 'danger' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHT = { sm: 40, md: 52, lg: 56 } as const;
const FONT_SIZE = { sm: 13, md: 15, lg: 17 } as const;
// iOS HIG minimum tap target is 44x44pt. `sm` renders at 40 to keep the visual
// density of compact/inline CTAs — hitSlop expands the tappable area to 44
// without changing how the button looks. md/lg already clear 44 on their own.
const HIT_SLOP = { sm: { top: 2, bottom: 2, left: 2, right: 2 }, md: undefined, lg: undefined } as const;

export function PrimaryButton({
  label, onPress, disabled, loading,
  variant = 'dark', size = 'md', fullWidth, icon, style,
}: PrimaryButtonProps) {
  const C = useTheme();

  // Disabled keeps its colours and fades (mock), so the button never changes shape.
  const bg = variant === 'accent' ? C.accent
    : variant === 'dark' ? C.alwaysDark
    : variant === 'destructive' ? C.danger
    : variant === 'ghost' || variant === 'danger' ? 'transparent'
    : C.surface;

  const textColor = variant === 'surface' ? C.t1
    : variant === 'ghost' ? C.accent
    : variant === 'danger' ? C.danger
    : C.alwaysLight;

  const borderStyle = variant === 'surface'
    ? { borderWidth: 0.5, borderColor: C.border }
    : variant === 'danger'
    ? { borderWidth: 1.5, borderColor: C.danger }
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={HIT_SLOP[size]}
      style={({ pressed }) => [
        styles.btn,
        { height: HEIGHT[size], backgroundColor: bg },
        borderStyle,
        fullWidth && styles.fullWidth,
        (disabled || loading) && !loading && styles.disabled,
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
  disabled:  { opacity: 0.35 },
});
