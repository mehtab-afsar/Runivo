import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { useTheme, Type } from '@theme';

interface TextButtonProps {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/**
 * A plain-text press action — Cancel/Skip links, inline "Delete account"
 * rows — no fill, no border. Was 3 different treatments across the app
 * (a fully-bordered button, a solid-fill sheet button, a bare unstyled
 * &lt;Text&gt;); this is the one.
 */
export function TextButton({ label, onPress, tone = 'default', disabled }: TextButtonProps) {
  const C = useTheme();
  const color = disabled ? C.t3 : tone === 'danger' ? C.red : C.t2;

  function handlePress() {
    if (disabled) return;
    Haptics.selectionAsync();
    onPress();
  }

  return (
    <Pressable onPress={handlePress} disabled={disabled} hitSlop={8}>
      {({ pressed }) => (
        <Text style={[Type.label, styles.text, { color, opacity: pressed && !disabled ? 0.6 : 1 }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'center' },
});
