import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Target, MapPin, Zap } from 'lucide-react-native';
import type { Mission } from '@shared/services/missions';

interface Props {
  mission: Mission;
  isLast?: boolean;
}

const ICON_MAP: Record<string, typeof Check> = {
  run_distance:       Target,
  capture_zones:      MapPin,
  run_in_enemy_zone:  MapPin,
  complete_run:       Check,
  beat_pace:          Zap,
};

export function MissionRow({ mission: m, isLast }: Props) {
  const Icon = ICON_MAP[m.type] ?? Target;
  const bar  = Math.min(m.current / Math.max(m.target, 1), 1);

  return (
    <View style={[ss.row, !isLast && ss.rowBorder]}>
      <View style={[ss.iconBox, m.completed && ss.iconBoxDone]}>
        {m.completed
          ? <Check size={13} color="#4ADE80" strokeWidth={1.5} />
          : <Icon  size={13} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ss.title, m.completed && ss.titleDone]}>{m.title}</Text>
        <View style={ss.barBg}>
          <View style={[ss.barFill, { width: `${bar * 100}%`, backgroundColor: m.completed ? '#4ADE80' : '#D93518' }]} />
        </View>
      </View>
      <Text style={[ss.xp, m.completed && ss.xpDone]}>+{m.rewards.xp} XP</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingBottom: 14, marginBottom: 14 },
  rowBorder:  { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  iconBox:    { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconBoxDone:{ backgroundColor: 'rgba(26,107,64,0.3)' },
  title:      { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#fff', marginBottom: 8 },
  titleDone:  { color: 'rgba(255,255,255,0.35)', textDecorationLine: 'line-through' },
  barBg:      { height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 1 },
  xp:         { fontFamily: 'Barlow_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  xpDone:     { color: '#4ADE80' },
});
