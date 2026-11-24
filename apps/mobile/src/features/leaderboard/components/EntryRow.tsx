import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RANK_COLORS } from '@shared/constants/territory';
import type { LeaderboardEntry } from '../types';
import { useTheme, Fonts, haptic, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';

interface Props {
  entry: LeaderboardEntry;
  unit: string;
  // Receives the entry so the parent can pass one stable handler rather than
  // allocating a closure per row — required for the React.memo below to bail out.
  // Undefined means "not tappable" (your own row).
  onPress?: (entry: LeaderboardEntry) => void;
  /** Where the row sits in the grouped card (rounded ends, divider). */
  position?: 'first' | 'middle' | 'last' | 'only';
}

/** Number and its unit, shown separately so the number can use the numeric face. */
export function splitValue(value: number, unit: string): { num: string; suffix: string } {
  if (unit === 'km')   return { num: value.toFixed(1), suffix: 'km' };
  if (unit === 'PACE') return { num: Intl.NumberFormat().format(value), suffix: 'PACE' };
  // Ground claimed in the period: 840 m², 12.4k m², 1.2M m².
  if (unit === 'm2') {
    const num = value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e4 ? `${(value / 1e3).toFixed(1)}k` : Intl.NumberFormat().format(Math.round(value));
    return { num, suffix: 'm²' };
  }
  return { num: Intl.NumberFormat().format(Math.round(value)), suffix: 'score' };
}

// Memoised: rendered once per leaderboard entry (page size 100).
export const EntryRow = React.memo(function EntryRow({ entry, unit, onPress, position = 'middle' }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const rankColor = RANK_COLORS[entry.runnerRank] ?? RANK_COLORS.pacer;

  return (
    <Pressable
      style={({ pressed }) => [
        s.row,
        (position === 'first' || position === 'only') && s.rowFirst,
        (position === 'last' || position === 'only') && s.rowLast,
        position !== 'last' && position !== 'only' && s.rowDivider,
        entry.isPlayer && s.rowMe,
        pressed && onPress && s.rowPressed,
      ]}
      onPress={onPress ? () => { haptic.light(); onPress(entry); } : undefined}
    >
      {/* Rank */}
      <Text style={s.rank}>{entry.rank}</Text>

      {/* Avatar — bordered in the runner's rank color, quietly encoding tier
          without a second loud chip competing with the score. */}
      <View style={[s.avatar, { borderColor: rankColor.fg, overflow: 'hidden' }, entry.isPlayer && s.avatarMe]}>
        <Avatar name={entry.name} uri={entry.avatarUrl ?? null} size={34} />
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
      <View style={s.valueWrap}>
        <Text style={[s.value, entry.isPlayer && { color: C.red }]}>{splitValue(entry.value, unit).num}</Text>
        {unit !== 'TS' && <Text style={s.valueUnit}>{splitValue(entry.value, unit).suffix}</Text>}
      </View>
    </Pressable>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 13,
      marginHorizontal: 18, backgroundColor: C.card,
    },
    rowFirst:   { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    rowLast:    { borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowPressed: { opacity: 0.6 },
    rowMe:      { backgroundColor: C.redLo },
    rank:      { fontFamily: Fonts.numeric, fontSize: 20, color: C.t3, width: 22 },
    avatar:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    avatarMe:  { borderColor: C.red },
    avatarText:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    nameWrap:  { flex: 1, gap: 1 },
    nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, flexShrink: 1 },
    tier:      { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t2, marginTop: 1 },
    youBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.red },
    youText:   { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysLight },
    valueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    value:     { fontFamily: Fonts.numeric, fontSize: 20, color: C.t1, fontVariant: ['tabular-nums'], minWidth: 54, textAlign: 'right' },
    valueUnit: { fontFamily: Fonts.numeric, fontSize: 12, color: C.t1 },
  });
}
