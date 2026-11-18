import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { Club } from '../types';
import Svg, { Polygon } from 'react-native-svg';

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

/** Club tiles use the palette's soft fills with dark initials, as in the mock. */
const TILE = [
  { bg: '#DCEBC8', fg: '#2F4D12' }, { bg: '#E4E1F8', fg: '#3C3577' },
  { bg: '#FDF0DF', fg: '#7A5525' }, { bg: '#17181A', fg: '#C9F06B' },
];
export function ClubInitialsTile({ name, size = 52, uri, shape = 'tile' }: { name: string; size?: number; uri?: string | null; shape?: 'tile' | 'hex' }) {
  if (shape === 'hex' && !uri) {
    // The club page's mark (mock): a pointy-top hexagon, ink with lime initials.
    const w = size, h = size * 1.1;
    const pts = [[w / 2, 0], [w, h * 0.25], [w, h * 0.75], [w / 2, h], [0, h * 0.75], [0, h * 0.25]].map(p => p.join(',')).join(' ');
    return (
      <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}><Polygon points={pts} fill="#17181A" /></Svg>
        <Text style={{ fontFamily: Fonts.semiBold, fontSize: size * 0.3, color: '#C9F06B' }}>{clubInitials(name)}</Text>
      </View>
    );
  }
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: '#EEF0EA' }} accessibilityIgnoresInvertColors />;
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const t = TILE[h % TILE.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.3, backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: Fonts.semiBold, fontSize: size * 0.32, color: t.fg }}>{clubInitials(name)}</Text>
    </View>
  );
}

function rankLine(rank: number | undefined, city: string | null | undefined): string | null {
  if (!rank) return null;
  return city ? `No. ${rank} in ${city}` : `No. ${rank} overall`;
}

/** A club the runner belongs to, as in the design: hero for the top club, white card for the rest. */
export const ClubHeroCard = React.memo(function ClubHeroCard({ club, rank, variant: _variant = 'card', onPress }: Props) {
  const variant = 'card' as 'hero' | 'card'; // mock: every club is a white row
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const meta = `${club.member_count} ${club.member_count === 1 ? 'member' : 'members'} · ${Math.round(club.total_km).toLocaleString()} km`;
  const standing = rankLine(rank, club.city);

  if (variant === 'card') {
    return (
      <Pressable style={({ pressed }) => [s.card, pressed && s.pressed]} onPress={onPress}
        accessibilityRole="button" accessibilityLabel={`${club.name}, ${meta}`}>
        <ClubInitialsTile name={club.name} size={44} uri={club.avatar_url} />
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
        <ClubInitialsTile name={club.name} size={52} uri={club.avatar_url} />
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
    card:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 14 },
    cardName: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    cardMeta: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
  });
}
