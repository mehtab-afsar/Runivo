import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface ShoeProgressBarProps {
  pct: number;
  color: string;
}

export function ShoeProgressBar({ pct, color }: ShoeProgressBarProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const filled = Math.min(Math.max(pct, 0), 1);
  return (
    <View style={s.bg}>
      <View style={[s.fill, { flex: filled, backgroundColor: color }]} />
      <View style={{ flex: Math.max(0, 1 - filled) }} />
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  bg: {
    height: 4, backgroundColor: C.mid, borderRadius: 2,
    overflow: 'hidden', flexDirection: 'row',
  },
  fill: { height: 4 },
}); }
