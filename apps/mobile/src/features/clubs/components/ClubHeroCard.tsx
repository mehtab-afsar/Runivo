import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import type { Club } from '../types';
import { getClubTier } from '../clubTier';

interface Props {
  club: Club;
  rank?: number;
  onPress: () => void;
}

/**
 * "My clubs" card — bold editorial treatment.
 *
 * Fixed-dark ground in both themes (C.alwaysDark), so it pairs only with
 * alwaysLight / white-alpha text. The club name is the one Playfair moment;
 * everything else is Barlow, and every number is tabular so rows don't jitter.
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
      {/* Vermilion rail — the single accent doing the work */}
      <View style={s.rail} />

      <View style={s.body}>
        <View style={s.topRow}>
          <View style={s.badge}>
            <BadgeIcon size={20} color={badgeColor} weight="light" />
          </View>
          <View style={[s.tierChip, { backgroundColor: tier.bg }]}>
            <Text style={[s.tierText, { color: tier.fg }]}>{tier.label.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {rank !== undefined && (
            <Text style={s.rank}>
              <Text style={s.rankHash}>#</Text>{rank}
            </Text>
          )}
        </View>

        <Text style={s.name} numberOfLines={2}>{club.name}</Text>

        {club.description ? (
          <Text style={s.desc} numberOfLines={1}>{club.description}</Text>
        ) : null}

        <View style={s.divider} />

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{club.member_count}</Text>
            <Text style={s.statLabel}>MEMBERS</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{Math.round(club.total_km).toLocaleString()}</Text>
            <Text style={s.statLabel}>TOTAL KM</Text>
          </View>
          <View style={{ flex: 1 }} />
          <CaretRight size={16} color="rgba(255,255,255,0.55)" weight="regular" />
        </View>
      </View>
    </Pressable>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: C.alwaysDark,
      borderRadius: Spacing.radius.xl,
      overflow: 'hidden',
      marginHorizontal: Spacing.gutter,
      marginBottom: 14,
      shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 }, elevation: 8,
    },
    pressed:  { opacity: 0.9, transform: [{ scale: 0.99 }] },
    rail:     { width: 3, backgroundColor: C.red },
    body:     { flex: 1, padding: 18 },

    topRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    badge:    {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center', justifyContent: 'center',
    },
    tierChip: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
    tierText: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 0.8 },
    rank:     { ...Type.metricSm, fontSize: 15, color: C.red },
    rankHash: { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.45)' },

    // The one Playfair moment on the card.
    name:     { fontFamily: Fonts.display, fontSize: 26, lineHeight: 30, color: C.alwaysLight },
    desc:     { ...Type.bodySm, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

    divider:  { height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 16, marginBottom: 12 },

    statsRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
    stat:        {},
    statDivider: { width: 0.5, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },
    statValue:   { ...Type.metricMd, fontSize: 22, lineHeight: 24, color: C.alwaysLight },
    statLabel:   { ...Type.overline, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  });
}
