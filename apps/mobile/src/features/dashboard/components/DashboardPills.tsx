import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Zap, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const LEVEL_TITLES = [
  'Scout', 'Pathfinder', 'Trailblazer', 'Ranger', 'Explorer',
  'Captain', 'Vanguard', 'Commander', 'Warlord', 'Legend',
];

interface Props {
  xp: number;
  level?: number;
  energy: number;
  streakDays: number;
}

const C = { red: '#D93518', amber: '#9E6800', border: '#DDD9D4', bg: '#FFFFFF', black: '#0A0A0A', t3: '#ADADAD' };

export function DashboardPills({ xp, level = 1, energy, streakDays }: Props) {
  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? 'Scout';

  return (
    <View style={ss.row}>
      <Pressable onPress={tap} style={ss.pill}>
        <Text style={ss.pillV}>{xp.toLocaleString()} XP</Text>
        <View style={ss.dot} />
        <Text style={ss.pillL}>{title}</Text>
      </Pressable>

      {energy < 5 && (
        <Pressable onPress={tap} style={ss.pill}>
          <Zap size={13} color={C.red} strokeWidth={1.5} />
          <Text style={ss.pillV}>{energy}/10</Text>
          <Text style={ss.pillL}>energy</Text>
        </Pressable>
      )}

      {(streakDays || 0) > 0 && (
        <Pressable onPress={tap} style={ss.pill}>
          <Flame size={13} color={C.red} strokeWidth={1.5} />
          <Text style={ss.pillV}>{streakDays}</Text>
          <Text style={ss.pillL}>day streak</Text>
        </Pressable>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 22, paddingBottom: 20 },
  pill: {
    height: 34, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border, borderRadius: 20,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.border },
  pillV: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black },
  pillL: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
});
