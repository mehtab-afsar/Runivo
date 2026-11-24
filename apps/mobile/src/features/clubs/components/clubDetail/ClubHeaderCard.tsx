import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { ClubInitialsTile } from '../ClubHeroCard';
import { clubSubLine } from '../../utils/clubDetailFormatters';

interface Props {
  clubName: string;
  banner: string | null;
  avatar: string | null;
  memberCount: number;
  totalKm: number;
  isAdmin: boolean;
}

/** Cover image (when set), then the club tile, name and member line. */
export function ClubHeaderCard({ clubName, banner, avatar, memberCount, totalKm, isAdmin }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      {!!banner && <Image source={{ uri: banner }} style={s.banner} resizeMode="cover" accessibilityIgnoresInvertColors />}
      <View style={[s.clubHero, !!banner && { marginTop: -28 }]}>
        <View style={!!banner && s.avatarRing}><ClubInitialsTile name={clubName} size={58} uri={avatar} shape="hex" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.clubName} numberOfLines={2}>{clubName}</Text>
          <Text style={s.subLine} numberOfLines={1}>
            {clubSubLine(memberCount, totalKm, isAdmin)}
          </Text>
        </View>
      </View>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    subLine:     { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    banner:      { height: 120, marginHorizontal: Spacing.gutter, borderRadius: 22, backgroundColor: C.card },
    avatarRing:  { borderWidth: 4, borderColor: C.bg, borderRadius: 22 },
    clubHero:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingTop: 4, paddingBottom: 16, gap: 14 },
    clubName:    { fontFamily: Fonts.semiBold, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, color: C.t1 },
  });
}
