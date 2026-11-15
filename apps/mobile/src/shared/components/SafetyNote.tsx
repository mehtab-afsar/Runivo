import React, { useMemo } from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

const COPY = {
  // On the run screen: where a runner reads it before heading out.
  run:   'Stay on public paths, follow traffic rules and never enter private property. Territory is a game, not a right of way.',
  // Wherever PaceX or a training plan gives advice.
  coach: 'PaceX and training plans give general running guidance, not medical advice. If you feel pain, dizziness or chest tightness, stop and see a doctor.',
} as const;

/**
 * A short, quiet safety line. The Terms say this too, but App Review (1.4) and
 * common sense want it where the advice or the run actually happens.
 */
export function SafetyNote({ kind, style }: { kind: keyof typeof COPY; style?: StyleProp<TextStyle> }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return <Text style={[s.note, style]} accessibilityRole="text">{COPY[kind]}</Text>;
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    note: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t3, textAlign: 'center', paddingHorizontal: 20, marginTop: 10 },
  });
}
