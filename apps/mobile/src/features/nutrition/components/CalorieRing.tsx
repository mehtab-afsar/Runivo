import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CalorieRingProps {
  consumed: number;
  goal: number;
  pct: number;
  size?: number;
}

function ringColor(pct: number): string {
  if (pct >= 1)   return '#C25A00';
  if (pct >= 0.8) return '#9E6800';
  return '#D93518';
}

export function CalorieRing({ consumed, goal, pct, size = 80 }: CalorieRingProps) {
  const color = ringColor(pct);
  const remaining = Math.max(0, goal - consumed);

  return (
    <View style={s.wrap}>
      <View style={[s.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
        <Text style={[s.kcal, { color }]}>{consumed}</Text>
        <Text style={s.label}>eaten</Text>
      </View>
      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statVal}>{goal}</Text>
          <Text style={s.statLabel}>goal</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statVal}>{remaining}</Text>
          <Text style={s.statLabel}>remaining</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
  },
  ring: {
    borderWidth: 4, alignItems: 'center', justifyContent: 'center',
  },
  kcal: { fontFamily: 'Barlow_700Bold', fontSize: 20 },
  label: { fontFamily: 'Barlow_300Light', fontSize: 9, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statVal: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: '#0A0A0A' },
  statLabel: { fontFamily: 'Barlow_300Light', fontSize: 9, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.5 },
});
