import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Diamond } from 'phosphor-react-native';
import { useTheme, useIsDark, Fonts, Spacing, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';

interface Props {
  rankName: string;
  isTopRank: boolean;
  nextName: string;
  paceToNext: number;
  /** 0–1 progress to the next rank. */
  pct: number;
}

/** Runner rank: current rank pill, PACE to the next one, and a progress bar. */
export default function RunRankCard({ rankName, isTopRank, nextName, paceToNext, pct }: Props) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={[ss.card, ss.surface, ss.rankCard]}>
      <View style={ss.rankRow}>
        <View style={ss.rankPill}>
          <Diamond size={12} color={zone.own} weight="fill" />
          <Text style={ss.rankName}>{rankName}</Text>
        </View>
        <Text style={ss.rankSub}>
          {!isTopRank
            ? <>{paceToNext} PACE to <Text style={ss.rankSubStrong}>{nextName}</Text></>
            : 'Top rank'}
        </Text>
      </View>
      {!isTopRank && (
        <View style={ss.progressOuter}>
          <View style={[ss.progressInner, { width: `${Math.round(pct * 100)}%`, backgroundColor: zone.own }]} />
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:          { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    surface:       { backgroundColor: C.card, borderRadius: 24 },
    rankCard:      { paddingHorizontal: 18, paddingVertical: 14 },
    rankRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rankPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.t1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    rankName:      { fontFamily: Fonts.semiBold, fontSize: 12, color: C.bg },
    progressOuter: { height: 8, borderRadius: 4, backgroundColor: C.bg, marginTop: 12, overflow: 'hidden' },
    progressInner: { height: 8, borderRadius: 4 },
    rankSub:       { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    rankSubStrong: { fontFamily: Fonts.semiBold, color: C.t1 },
  });
}
