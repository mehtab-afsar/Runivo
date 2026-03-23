import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { LeaderboardTab, LeaderboardTimeFrame } from '../types';

const C = { white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD' };

interface Props {
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  onTabChange: (t: LeaderboardTab) => void;
  onTimeFrameChange: (tf: LeaderboardTimeFrame) => void;
}

const TABS: { value: LeaderboardTab; label: string }[] = [
  { value: 'distance', label: 'Distance' },
  { value: 'xp', label: 'XP' },
  { value: 'territories', label: 'Zones' },
];

const TIMEFRAMES: { value: LeaderboardTimeFrame; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

export function LeaderboardFilters({ tab, timeFrame, onTabChange, onTimeFrameChange }: Props) {
  return (
    <>
      <View style={s.tabRow}>
        {TABS.map(t => (
          <Pressable key={t.value} style={[s.tabBtn, tab === t.value && s.tabBtnActive]} onPress={() => onTabChange(t.value)}>
            <Text style={[s.tabLabel, tab === t.value && s.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.tfRow}>
        {TIMEFRAMES.map(tf => (
          <Pressable key={tf.value} style={[s.tfBtn, timeFrame === tf.value && s.tfBtnActive]} onPress={() => onTimeFrameChange(tf.value)}>
            <Text style={[s.tfLabel, timeFrame === tf.value && s.tfLabelActive]}>{tf.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  tabRow: { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  tabBtnActive: { backgroundColor: C.black, borderColor: C.black },
  tabLabel: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t2 },
  tabLabelActive: { color: '#fff', fontFamily: 'Barlow_500Medium' },
  tfRow: { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 10 },
  tfBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  tfBtnActive: { backgroundColor: '#E8E4DF' },
  tfLabel: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  tfLabelActive: { color: C.black, fontFamily: 'Barlow_400Regular' },
});
