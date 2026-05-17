import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  headline: string;
  body: string;
  consistencyScore: number;
  paceWeeklyEarned: number;
  paceWeeklyCap: number;
}

export function PaceInsightCard({ headline, body, consistencyScore, paceWeeklyEarned, paceWeeklyCap }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const fillFraction = Math.min(1, paceWeeklyCap > 0 ? paceWeeklyEarned / paceWeeklyCap : 0);

  return (
    <View style={s.card}>
      <View style={s.accentBar} />
      <View style={s.content}>
        <View style={s.topRow}>
          <Text style={s.headline} numberOfLines={1}>{headline}</Text>
          <View style={s.csWrap}>
            <Text style={s.csNum}>{consistencyScore}</Text>
            <Text style={s.csLabel}>CS</Text>
          </View>
        </View>
        <Text style={s.body} numberOfLines={2}>{body}</Text>
        <View style={s.paceRow}>
          <Text style={s.paceLabel}>PACE  {paceWeeklyEarned}/{paceWeeklyCap}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { flex: fillFraction }]} />
            <View style={{ flex: 1 - fillFraction }} />
          </View>
        </View>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:      { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden', marginHorizontal: 16, marginBottom: 14 },
    accentBar: { width: 3, backgroundColor: C.red },
    content:   { flex: 1, padding: 14, gap: 6 },
    topRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    headline:  { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: C.black, flex: 1 },
    csWrap:    { alignItems: 'center', flexShrink: 0 },
    csNum:     { fontFamily: 'Barlow_600SemiBold', fontSize: 22, color: C.black, lineHeight: 24 },
    csLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, letterSpacing: 0.6 },
    body:      { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t2, lineHeight: 18 },
    paceRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    paceLabel: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t3, letterSpacing: 0.4 },
    barTrack:  { flex: 1, height: 3, backgroundColor: C.mid, borderRadius: 2, flexDirection: 'row', overflow: 'hidden' },
    barFill:   { backgroundColor: C.red, borderRadius: 2 },
  });
}
