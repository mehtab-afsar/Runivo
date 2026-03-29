import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RankBadge } from './RankBadge';
import type { LeaderboardEntry } from '../types';

const C = { white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t3: '#ADADAD', red: '#D93518' };

interface Props {
  entry: LeaderboardEntry;
  unit: string;
  onPress?: () => void;
}

export function EntryRow({ entry, unit, onPress }: Props) {
  return (
    <Pressable style={[s.row, entry.isPlayer && s.rowMe]} onPress={onPress}>
      <RankBadge rank={entry.rank} />
      <View style={s.avatar}>
        <Text style={s.avatarText}>{entry.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.name, entry.isPlayer && s.nameMe]}>{entry.name}</Text>
        <Text style={s.level}>Lv. {entry.level}</Text>
      </View>
      <Text style={[s.value, entry.isPlayer && s.valueMe]}>
        {unit === 'km' ? entry.value.toFixed(1) : entry.value.toLocaleString()} {unit}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12, marginBottom: 6 },
  rowMe: { borderColor: C.red, backgroundColor: '#FEF8F7' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2C3E7A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Barlow_700Bold', fontSize: 11, color: '#fff' },
  name: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  nameMe: { color: C.red },
  level: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  value: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black },
  valueMe: { color: C.red },
});
