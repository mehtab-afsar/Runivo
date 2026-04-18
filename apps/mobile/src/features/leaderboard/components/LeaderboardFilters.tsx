import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Globe, Flag, MapPin } from 'lucide-react-native';
import type { LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';
import { Colors } from '@theme';

const C = Colors;

interface Props {
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  scope: LeaderboardScope;
  onTabChange: (t: LeaderboardTab) => void;
  onTimeFrameChange: (tf: LeaderboardTimeFrame) => void;
  onScopeChange: (s: LeaderboardScope) => void;
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

const SCOPE_ICONS: Record<string, React.ReactNode> = {
  global:   <Globe size={11} color="#6B6B6B" strokeWidth={1.5} />,
  national: <Flag size={11} color="#6B6B6B" strokeWidth={1.5} />,
  local:    <MapPin size={11} color="#6B6B6B" strokeWidth={1.5} />,
};
const SCOPES: { value: LeaderboardScope; label: string }[] = [
  { value: 'global',   label: 'Global'   },
  { value: 'national', label: 'National' },
  { value: 'local',    label: 'Local'    },
];

export function LeaderboardFilters({ tab, timeFrame, scope, onTabChange, onTimeFrameChange, onScopeChange }: Props) {
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
      <View style={s.scopeRow}>
        {SCOPES.map(sc => (
          <Pressable key={sc.value} style={[s.scopeBtn, scope === sc.value && s.scopeBtnActive]} onPress={() => onScopeChange(sc.value)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {SCOPE_ICONS[sc.value]}
              <Text style={[s.scopeLabel, scope === sc.value && s.scopeLabelActive]}>{sc.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  tabRow:         { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 8 },
  tabBtn:         { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  tabBtnActive:   { backgroundColor: C.black, borderColor: C.black },
  tabLabel:       { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t2 },
  tabLabelActive: { color: '#fff', fontFamily: 'Barlow_500Medium' },
  tfRow:          { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 8 },
  tfBtn:          { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  tfBtnActive:    { backgroundColor: '#E8E4DF' },
  tfLabel:        { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  tfLabelActive:  { color: C.black, fontFamily: 'Barlow_400Regular' },
  scopeRow:       { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 10 },
  scopeBtn:       { flex: 1, paddingVertical: 6, borderRadius: 20, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  scopeBtnActive: { backgroundColor: C.black, borderColor: C.black },
  scopeLabel:     { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t2 },
  scopeLabelActive:{ color: C.white, fontFamily: 'Barlow_500Medium' },
});
