import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { Club } from '../types';

interface Props {
  club: Club;
  /** Rank by total km among all clubs (1-based). */
  rank?: number;
  /** The runner's top club gets the black hero card; the rest are white cards. */
  variant?: 'hero' | 'card';
  onPress: () => void;
}

/** Up to three initials, e.g. "Hyde Park Hustlers" → "HPH". */
export function clubInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.map(w => w[0]) : [...(words[0] ?? '?')].slice(0, 2);
  return letters.slice(0, 3).join('').toUpperCase();
}

export function ClubInitialsTile({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.27, backgroundColor: avatarColor(name),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: size * 0.3, color: '#FFFFFF' }}>{clubInitials(name)}</Text>
    </View>
  );
}

function rankLine(rank: number | undefined, city: string | null | undefined): string | null {
  if (!rank) return null;
  return city ? `No. ${rank} in ${city}` : `No. ${rank} overall`;
}

/** A club the runner belongs to, as in the design: hero for the top club, white card for the rest. */
export const ClubHeroCard = React.memo(function ClubHeroCard({ club, rank, variant = 'hero', onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const meta = `${club.member_count} ${club.member_count === 1 ? 'member' : 'members'} · ${Math.round(club.total_km).toLocaleString()} km`;
  const standing = rankLine(rank, club.city);

  if (variant === 'card') {
    return (
      <Pressable style={({ pressed }) => [s.card, pressed && s.pressed]} onPress={onPress}
        accessibilityRole="button" accessibilityLabel={`${club.name}, ${meta}`}>
        <ClubInitialsTile name={club.name} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{club.name}</Text>
          <Text style={s.cardMeta} numberOfLines={1}>{standing ? `${meta} · ${standing}` : meta}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={({ pressed }) => [s.hero, pressed && s.pressed]} onPress={onPress}
      accessibilityRole="button" accessibilityLabel={`${club.name}, ${meta}`}>
      {standing && (
        <View style={s.rankChip}><Text style={s.rankText}>{standing}</Text></View>
      )}
      <View style={s.heroRow}>
        <ClubInitialsTile name={club.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={s.heroName} numberOfLines={1}>{club.name}</Text>
          <Text style={s.heroMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </View>
    </Pressable>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    hero:     { backgroundColor: C.alwaysDark, borderRadius: 16, padding: 16, gap: 14 },
    pressed:  { opacity: 0.92, transform: [{ scale: 0.99 }] },
    rankChip: { alignSelf: 'flex-start', backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    rankText: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.alwaysLight },
    heroRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
    heroName: { fontFamily: Fonts.bold, fontSize: 21, lineHeight: 22, color: C.alwaysLight, letterSpacing: -0.5 },
    heroMeta: { fontFamily: Fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    card:     {
      flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 16, padding: 16,
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    cardName: { fontFamily: Fonts.bold, fontSize: 19, lineHeight: 20, color: C.t1, letterSpacing: -0.45 },
    cardMeta: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 4 },
  });
}
