import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Diamond } from 'phosphor-react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import type { LeaderboardEntry } from '../types';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  entry: LeaderboardEntry;
  unit: string;
  onPress?: () => void;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'km')   return `${value.toFixed(1)} km`;
  if (unit === 'PACE') return `${value} PACE`;
  return `${Intl.NumberFormat().format(Math.round(value))} TS`;
}

export function EntryRow({ entry, unit, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const rankColor = RANK_COLORS[entry.runnerRank] ?? RANK_COLORS.pacer;

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

      {/* Runner Rank badge */}
      <View style={[s.rankBadge, { backgroundColor: rankColor.bg }]}>
        <Text style={[s.rankText, { color: rankColor.fg }]}>
          {entry.runnerRank.toUpperCase()}
        </Text>
      </View>

      {/* Score */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {unit === 'PACE' && <Diamond size={10} color={C.red} weight="light" />}
        <Text style={s.value}>{formatValue(entry.value, unit)}</Text>
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.mid, backgroundColor: C.card },
    rowMe:     { backgroundColor: C.redLo },
    rank:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, width: 20, textAlign: 'center', fontVariant: ['tabular-nums'] },
    avatar:    { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.border },
    avatarText:{ fontFamily: Fonts.medium, fontSize: 10, color: C.white },
    nameWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
    name:      { fontFamily: Fonts.regular, fontSize: 12, color: C.black },
    youBadge:  { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 2, backgroundColor: C.redLo, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.2)' },
    youText:   { fontFamily: Fonts.medium, fontSize: 10, color: C.red, textTransform: 'uppercase' },
    rankBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    rankText:  { fontFamily: Fonts.medium, fontSize: 10, textTransform: 'uppercase' },
    value:     { fontFamily: Fonts.regular, fontSize: 13, color: C.black, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  });
}
