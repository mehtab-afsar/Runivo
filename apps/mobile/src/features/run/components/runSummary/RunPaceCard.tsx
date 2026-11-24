import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import type { PacePart } from '../../utils/runSummaryTypes';

interface Props {
  paceEarned: number;
  /** The count-up figure shown while PACE animates in. */
  paceDisplay: number;
  /** Weekly cap the run hit (phone's own figure), if any. */
  cappedAt?: number;
  /** The weekly cap was hit, by the phone's count or the server's. */
  capped: boolean;
  plus: boolean;
  parts: PacePart[];
  onSeePlus: () => void;
}

/** PACE earned: the figure, a stacked bar of where it came from, and the Plus nudge at the cap. */
export default function RunPaceCard({ paceEarned, paceDisplay, cappedAt, capped, plus, parts, onSeePlus }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={[ss.card, ss.surface, ss.paceCard]}>
      <View style={ss.cardHead}>
        <Text style={ss.cardTitle}>PACE earned</Text>
        {cappedAt != null && <Text style={ss.capChip}>Weekly cap hit</Text>}
      </View>
      <View style={ss.paceBigRow}>
        <Text style={[ss.paceBig, paceEarned === 0 && { color: C.t3 }]}>{paceEarned > 0 ? `+${paceDisplay}` : '0'}</Text>
        <Text style={ss.paceSuffix}>PACE</Text>
      </View>
      {parts.length > 0 ? (
        <>
          <View style={ss.stackBar}>
            {parts.map(p => <View key={p.key} style={{ flex: p.value, backgroundColor: p.color }} />)}
          </View>
          <View style={ss.legend}>
            {parts.map(p => (
              <View key={p.key} style={ss.legendItem}>
                <View style={[ss.bdSwatch, { backgroundColor: p.color }]} />
                <Text style={ss.legendTxt}>{p.label} <Text style={ss.legendVal}>+{p.value}</Text></Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={ss.paceZero}>
          {cappedAt != null
            ? `Weekly cap of ${cappedAt} reached. It resets Monday`
            : 'PACE starts at 2 per full km on a run'}
        </Text>
      )}
      {capped && !plus && (
        <Pressable style={ss.plusRow} onPress={onSeePlus} accessibilityRole="button">
          <Text style={ss.plusRowText}>Runivo Plus raises your weekly cap to 150</Text>
          <Text style={ss.plusRowCta}>See Plus</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    surface:     { backgroundColor: C.card, borderRadius: 24 },
    cardHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle:   { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    paceCard:    { paddingHorizontal: 18, paddingVertical: 16 },
    paceBigRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
    paceBig:     { fontFamily: Fonts.numeric, fontSize: 54, lineHeight: 48, color: C.red, fontVariant: ['tabular-nums'] },
    paceSuffix:  { fontFamily: Fonts.bold, fontSize: 18, letterSpacing: -0.4, color: C.t1 },
    paceZero:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 19, marginTop: 4 },
    stackBar:    { flexDirection: 'row', height: 10, borderRadius: 9, overflow: 'hidden', gap: 2, marginTop: 12 },
    legend:      { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 },
    legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendTxt:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    legendVal:   { fontFamily: Fonts.semiBold, color: C.t1 },
    bdSwatch:    { width: 10, height: 10, borderRadius: 3 },
    capChip:     { fontFamily: Fonts.semiBold, fontSize: 11, color: C.amber, backgroundColor: C.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
    plusRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    plusRowText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2 },
    plusRowCta:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red },
  });
}
