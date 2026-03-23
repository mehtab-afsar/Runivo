import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Zap, Flame, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GAME_CONFIG } from '@shared/services/config';
import { calculateLevel } from '@shared/hooks/useGameEngine';

interface Props {
  xp: number;
  energy: number;
  streakDays: number;
}

const C = { red: '#D93518', amber: '#9E6800', border: '#DDD9D4', bg: '#FFFFFF', black: '#0A0A0A', t3: '#ADADAD' };

export function DashboardPills({ xp, energy, streakDays }: Props) {
  const level = calculateLevel(xp);
  const levelTitle = GAME_CONFIG.LEVEL_TITLES[Math.min(level - 1, GAME_CONFIG.LEVEL_TITLES.length - 1)];
  const showEnergy = energy < 5;
  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  return (
    <View style={ss.row}>
      <Pressable onPress={tap} style={ss.pill}>
        <Star size={13} color={C.black} strokeWidth={1.5} />
        <Text style={ss.pillV}>{xp.toLocaleString()} XP</Text>
        <View style={ss.dot} />
        <Text style={ss.pillL}>{levelTitle}</Text>
      </Pressable>

      {(streakDays || 0) > 0 && (
        <Pressable onPress={tap} style={ss.pill}>
          <Flame size={13} color={C.red} strokeWidth={1.5} />
          <Text style={ss.pillV}>{streakDays}</Text>
          <Text style={ss.pillL}>day streak</Text>
        </Pressable>
      )}

      {showEnergy && (
        <Pressable onPress={tap} style={[ss.pill, ss.pillAmber]}>
          <Zap size={13} color={C.amber} strokeWidth={1.5} />
          <Text style={[ss.pillV, { color: C.amber }]}>{energy}/10</Text>
          <Text style={ss.pillL}>energy low</Text>
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
  pillAmber: { borderColor: 'rgba(158,104,0,0.25)', backgroundColor: '#FDF6E8' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.border },
  pillV: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black },
  pillL: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
});
