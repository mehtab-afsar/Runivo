import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Diamond } from 'phosphor-react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import type { LeaderboardEntry } from '../types';
import { useTheme, Fonts, Spacing, haptic, type AppColors } from '@theme';

interface Props {
  entry: LeaderboardEntry;
  unit: string;
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
export const EntryRow = React.memo(function EntryRow({ entry, unit, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const rankColor = RANK_COLORS[entry.runnerRank] ?? RANK_COLORS.pacer;

  return (
    <Pressable
      style={({ pressed }) => [s.row, entry.isPlayer && s.rowMe, pressed && onPress && s.rowPressed]}
      onPress={onPress ? () => { haptic.light(); onPress(entry); } : undefined}
    >
      {/* Rank */}
      <Text style={s.rank}>{entry.rank}</Text>

      {/* Avatar — bordered in the runner's rank color, quietly encoding tier
          without a second loud chip competing with the score. */}
      <View style={[s.avatar, { backgroundColor: avatarColor(entry.name), borderColor: rankColor.fg }, entry.isPlayer && s.avatarMe]}>
        <Text style={s.avatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
      </View>

      {/* Name · tier, one quiet line — You gets the only pill on the row */}
      <View style={s.nameWrap}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{entry.name}</Text>
          {entry.isPlayer && (
            <View style={s.youBadge}><Text style={s.youText}>You</Text></View>
          )}
        </View>
        <Text style={s.tier}>{entry.runnerRank.charAt(0).toUpperCase()}{entry.runnerRank.slice(1)}</Text>
      </View>

      {/* Score */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {unit === 'PACE' && <Diamond size={10} color={C.red} weight="light" />}
        <Text style={s.value}>{formatValue(entry.value, unit)}</Text>
      </View>
    </Pressable>
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
    avatar:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    avatarMe:  { borderWidth: 1.5, borderColor: C.red },
    avatarText:{ fontFamily: Fonts.medium, fontSize: 11, color: C.white },
    nameWrap:  { flex: 1, gap: 1 },
    nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name:      { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    tier:      { fontFamily: Fonts.regular, fontSize: 10.5, color: C.t3 },
    youBadge:  { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: C.card, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.3)' },
    youText:   { fontFamily: Fonts.medium, fontSize: 10, color: C.red, textTransform: 'uppercase' },
    value:     { fontFamily: Fonts.regular, fontSize: 13, color: C.black, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  });
}
