import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import type { Club } from '../types';
import { getClubTier } from '../clubTier';

interface Props {
  club: Club;
  rank?: number;
  onPress: () => void;
}

/**
 * "My clubs" card — compact, two-up grid tile.
 *
 * Used to be a full-width editorial hero (26px display name, stats row,
 * ~180px tall) — with more than one or two clubs it read as an endless
 * stack of near-identical black slabs. This is a tile: badge, name, tier,
 * two stats, sized so two sit side by side — a dashboard of your clubs,
 * not a feed of them.
 */
export const ClubHeroCard = React.memo(function ClubHeroCard({ club, rank, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(club.badge_emoji);
  const tier = getClubTier(club.total_km);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${club.name}, ${club.member_count} members`}
    >
      <View style={s.topRow}>
        <View style={s.badge}>
          <BadgeIcon size={16} color={badgeColor} weight="light" />
        </View>
        {rank !== undefined && (
          <Text style={s.rank}><Text style={s.rankHash}>#</Text>{rank}</Text>
        )}
      </View>

      <Text style={s.name} numberOfLines={1}>{club.name}</Text>
      <View style={[s.tierChip, { backgroundColor: tier.bg }]}>
        <Text style={[s.tierText, { color: tier.fg }]}>{tier.label}</Text>
      </View>

      <View style={s.statsRow}>
        <Text style={s.statValue}>{club.member_count}</Text>
        <Text style={s.statLabel}>{club.member_count === 1 ? 'member' : 'members'}</Text>
      </View>
      <View style={s.statsRow}>
        <Text style={s.statValue}>{Math.round(club.total_km).toLocaleString()}</Text>
        <Text style={s.statLabel}>km</Text>
      </View>
    </Pressable>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: C.alwaysDark,
      borderRadius: Spacing.radius.lg,
      padding: 14,
    },
    pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

    topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    badge:   { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    rank:    { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red },
    rankHash:{ fontFamily: Fonts.medium, fontSize: 10, color: 'rgba(255,255,255,0.4)' },

    name:    { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight, marginBottom: 6 },
    tierChip:{ alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 12 },
    tierText:{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' },

    statsRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    statValue: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: Fonts.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' },
  });
}
