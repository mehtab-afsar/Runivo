import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ShoeProgressBarProps {
  pct: number;
  color: string;
}

export function ShoeProgressBar({ pct, color }: ShoeProgressBarProps) {
  const filled = Math.min(Math.max(pct, 0), 1);
  return (
    <View style={s.bg}>
      <View style={[s.fill, { flex: filled, backgroundColor: color }]} />
      <View style={{ flex: Math.max(0, 1 - filled) }} />
    </View>
  );
}

const s = StyleSheet.create({
  bg: {
    height: 4, backgroundColor: '#E8E4DF', borderRadius: 2,
    overflow: 'hidden', flexDirection: 'row',
  },
  fill: { height: 4 },
});
