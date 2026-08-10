import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Diamond } from 'phosphor-react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import type { LeaderboardEntry } from '../types';
import { useTheme, Fonts, Spacing, Spring, haptic, type AppColors } from '@theme';

interface Props {
  entry: LeaderboardEntry;
  unit: string;
  // Position within the list — used only to stagger the entrance animation,
  // capped so rows far down the board don't inherit a long, sluggish delay.
  index: number;
  // Receives the entry so the parent can pass one stable handler rather than
  // allocating a closure per row — required for the React.memo below to bail out.
  // Undefined means "not tappable" (your own row).
  onPress?: (entry: LeaderboardEntry) => void;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'km')   return `${value.toFixed(1)} km`;
  if (unit === 'PACE') return `${value} PACE`;
  return `${Intl.NumberFormat().format(Math.round(value))} TS`;
}

// Memoised: rendered once per leaderboard entry (page size 100).
export const EntryRow = React.memo(function EntryRow({ entry, unit, index, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const rankColor = RANK_COLORS[entry.runnerRank] ?? RANK_COLORS.pacer;
  const delay = Math.min(index, 8) * 30;

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(Spring.snappy.damping).stiffness(Spring.snappy.stiffness)}>
      <Pressable
        style={({ pressed }) => [s.row, entry.isPlayer && s.rowMe, pressed && onPress && s.rowPressed]}
        onPress={onPress ? () => { haptic.light(); onPress(entry); } : undefined}
      >
        {/* Rank */}
        <Text style={s.rank}>{entry.rank}</Text>

        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: avatarColor(entry.name) }, entry.isPlayer && s.avatarMe]}>
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
    </Animated.View>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 11,
      marginHorizontal: Spacing.gutter, marginBottom: 8,
      borderRadius: Spacing.radius.md, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card,
    },
    rowPressed: { opacity: 0.6 },
    rowMe: {
      backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.35)',
      shadowColor: C.red, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 2,
    },
    rank:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, width: 20, textAlign: 'center', fontVariant: ['tabular-nums'] },
    avatar:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.border },
    avatarMe:  { borderWidth: 1.5, borderColor: C.red },
    avatarText:{ fontFamily: Fonts.medium, fontSize: 11, color: C.white },
    nameWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
    name:      { fontFamily: Fonts.regular, fontSize: 12.5, color: C.black },
    youBadge:  { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: C.card, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.3)' },
    youText:   { fontFamily: Fonts.medium, fontSize: 10, color: C.red, textTransform: 'uppercase' },
    rankBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    rankText:  { fontFamily: Fonts.medium, fontSize: 10, textTransform: 'uppercase' },
    value:     { fontFamily: Fonts.regular, fontSize: 13, color: C.black, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  });
}
