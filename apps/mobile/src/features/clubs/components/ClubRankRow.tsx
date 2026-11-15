import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import type { Club } from '../types';
import { getClubTier } from '../clubTier';

interface Props {
  club: Club;
  rank: number;
  onPress: (club: Club) => void;
  onJoin: (club: Club) => void;
  onLeave: (club: Club) => void;
  isLast?: boolean;
}

/** Medal treatment for the top three — gold/silver/bronze, everyone else is ink. */
function rankColor(rank: number, C: AppColors): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return C.t3;
}

export const ClubRankRow = React.memo(function ClubRankRow({
  club, rank, onPress, onJoin, onLeave, isLast,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(club.badge_emoji);
  const tier = getClubTier(club.total_km);
  const isPodium = rank <= 3;

  return (
    <Pressable
      style={({ pressed }) => [s.row, !isLast && s.rowBorder, pressed && s.pressed]}
      onPress={() => onPress(club)}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}, ${club.name}, ${Math.round(club.total_km)} kilometres`}
    >
      {/* Rank — oversized and light, the editorial anchor of the row */}
      <Text style={[s.rank, { color: rankColor(rank, C) }, isPodium && s.rankPodium]}>
        {rank}
      </Text>

      <View style={s.badge}>
        <BadgeIcon size={18} color={badgeColor} weight="light" />
      </View>

      <View style={s.middle}>
        <Text style={s.name} numberOfLines={1}>{club.name}</Text>
        <View style={s.metaRow}>
          <View style={[s.tierDot, { backgroundColor: tier.fg }]} />
          <Text style={s.meta} numberOfLines={1}>
            {tier.label} · {club.member_count} {club.member_count === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>

      <View style={s.right}>
        <Text style={s.km}>
          {Math.round(club.total_km).toLocaleString()}
          <Text style={s.kmUnit}> km</Text>
        </Text>

        {/* Previously this row accepted onJoin/onLeave and rendered neither, so
            there was no way to join a club from the rankings at all — the only
            component with a join control had zero importers. */}
        {club.joined ? (
          <Pressable
            style={s.joinedPill}
            onPress={() => onLeave(club)}
            hitSlop={6}
            accessibilityLabel={`Leave ${club.name}`}
          >
            <Text style={s.joinedText}>Joined</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.joinPill, club.requested && { opacity: 0.6 }]}
            onPress={() => onJoin(club)}
            disabled={club.requested}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              club.requested ? `Request to join ${club.name} sent`
              : club.join_policy === 'open' ? `Join ${club.name}` : `Request to join ${club.name}`
            }
          >
            <Text style={s.joinText}>
              {club.requested ? 'Requested' : club.join_policy === 'open' ? 'Join' : 'Request'}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: Spacing.gutter,
      backgroundColor: C.card,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    pressed:   { backgroundColor: C.surface },

    rank:       { ...Type.metricMd, fontSize: 26, lineHeight: 28, width: 34, textAlign: 'center' },
    rankPodium: { fontFamily: Fonts.semiBold },

    badge: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },

    middle:   { flex: 1, minWidth: 0 },
    name:     { ...Type.headline, color: C.t1 },
    metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
    tierDot:  { width: 5, height: 5, borderRadius: 2.5 },
    meta:     { ...Type.caption, color: C.t2, flexShrink: 1 },

    right:    { alignItems: 'flex-end', gap: 6 },
    km:       { ...Type.metricSm, fontSize: 20, lineHeight: 22, color: C.t1 },
    kmUnit:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },

    joinPill:   { backgroundColor: C.red, borderRadius: Spacing.radius.full, paddingHorizontal: 14, paddingVertical: 6 },
    joinText:   { fontFamily: Fonts.semiBold, fontSize: 12, color: C.alwaysLight },
    joinedPill: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: Spacing.radius.full, paddingHorizontal: 14, paddingVertical: 6 },
    joinedText: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },
  });
}
