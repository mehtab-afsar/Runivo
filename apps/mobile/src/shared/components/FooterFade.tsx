/**
 * A short fade at the top edge of a fixed footer, so content scrolling under
 * the footer reads as "more below" instead of cut off. Put it first inside the
 * footer; the footer needs no extra styles.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@theme';

/** '#RRGGBB' → 'rgba(r,g,b,a)'. */
function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function FooterFade({ color, height = 28 }: { color?: string; height?: number }) {
  const C = useTheme();
  const base = color ?? C.bg;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[withAlpha(base, 0), base]}
      style={[StyleSheet.absoluteFillObject, { top: -height, bottom: undefined, height }]}
    />
  );
}
