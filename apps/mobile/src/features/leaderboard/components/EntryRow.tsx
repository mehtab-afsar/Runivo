import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { LeaderboardEntry } from '../types';
import { useTheme, type AppColors } from '@theme';

interface Props {
  entry: LeaderboardEntry;
  unit: string;
  onPress?: () => void;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'km')  return `${value.toFixed(1)} km`;
  if (unit === 'XP')  return `${value.toLocaleString()} XP`;
  return `${Math.floor(value)} zones`;
}

export function EntryRow({ entry, unit, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <Pressable
      style={[s.row, entry.isPlayer && s.rowMe]}
      onPress={onPress}
    >
      {/* Rank */}
      <Text style={s.rank}>{entry.rank}</Text>

      {/* Avatar */}
      <View style={[s.avatar, { backgroundColor: avatarColor(entry.name) }]}>
        <Text style={s.avatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
      </View>

      {/* Name + You badge */}
      <View style={s.nameWrap}>
        <Text style={s.name} numberOfLines={1}>{entry.name}</Text>
        {entry.isPlayer && (
          <View style={s.youBadge}><Text style={s.youText}>You</Text></View>
        )}
      </View>

      {/* Level badge */}
      <View style={s.lvlBadge}>
        <Text style={s.lvlText}>LV. {entry.level}</Text>
      </View>

      {/* Score */}
      <Text style={s.value}>{formatValue(entry.value, unit)}</Text>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.mid, backgroundColor: C.white },
    rowMe:    { backgroundColor: C.redLo },
    rank:     { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t3, width: 20, textAlign: 'center' },
    avatar:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.border },
    avatarText: { fontFamily: 'Barlow_500Medium', fontSize: 9, color: '#FFFFFF' },
    nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
    name:     { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
    youBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 2, backgroundColor: C.redLo, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.2)' },
    youText:  { fontFamily: 'Barlow_500Medium', fontSize: 8, color: C.red, textTransform: 'uppercase' },
    lvlBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: C.stone },
    lvlText:  { fontFamily: 'Barlow_500Medium', fontSize: 8, color: C.t2, textTransform: 'uppercase' },
    value:    { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.black, letterSpacing: -0.3 },
  });
}
