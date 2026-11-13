import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useIsDark, Type, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';

export interface Split { km: number; pace: number }

interface SplitsListProps {
  splits: Split[];
}

function formatPace(paceMinPerKm: number): string {
  const m = Math.floor(paceMinPerKm);
  const s = Math.floor((paceMinPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Bar per km: taller is faster, the fastest km is in your colour. */
export default function SplitsList({ splits }: SplitsListProps) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);

  if (splits.length === 0) return null;

  const max = Math.max(...splits.map(s => s.pace));
  const min = Math.min(...splits.map(s => s.pace));
  const range = max - min || 1;
  const fastestIdx = splits.findIndex(s => s.pace === min);
  // Label every km up to 12 splits, then thin the axis so labels never collide.
  const labelEvery = splits.length <= 12 ? 1 : Math.ceil(splits.length / 8);

  return (
    <View style={ss.card}>
      <View style={ss.header}>
        <Text style={ss.title}>Splits</Text>
        <Text style={ss.meta}>
          Fastest, km {splits[fastestIdx].km}: <Text style={ss.metaStrong}>{formatPace(min)}</Text>
        </Text>
      </View>
      <View style={ss.chart}>
        {splits.map((s, i) => {
          const h = 30 + ((max - s.pace) / range) * 70;
          return (
            <View key={i} style={ss.col} accessibilityLabel={`Kilometre ${s.km}, ${formatPace(s.pace)} per km`}>
              <View style={[ss.bar, { height: `${h}%`, backgroundColor: i === fastestIdx ? zone.own : C.t1, opacity: i === fastestIdx ? 1 : 0.85 }]} />
            </View>
          );
        })}
      </View>
      <View style={ss.axis}>
        {splits.map((s, i) => (
          <Text key={i} style={[ss.axisLbl, i === fastestIdx && { color: zone.own }]}>
            {i % labelEvery === 0 || i === fastestIdx ? s.km : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:       { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title:      { ...Type.overline, color: C.t2 },
    meta:       { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    metaStrong: { fontFamily: Fonts.semiBold, color: C.t1 },
    chart:      { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 12 },
    col:        { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar:        { width: '100%', borderRadius: 4 },
    axis:       { flexDirection: 'row', gap: 6, marginTop: 6 },
    axisLbl:    { flex: 1, textAlign: 'center', fontFamily: Fonts.medium, fontSize: 11, color: C.t3, fontVariant: ['tabular-nums'] },
  });
}
