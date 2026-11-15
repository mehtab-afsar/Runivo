import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
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

  // One row per km, as on the mock: number, bar (longer is faster), pace.
  // Past 20 km, show every other row so a marathon stays scannable.
  const rows = splits.length > 20 ? splits.filter((_, i) => i % 2 === 0 || i === fastestIdx) : splits;
  return (
    <View style={ss.card}>
      <View style={ss.header}>
        <Text style={ss.title}>Splits</Text>
        <Text style={ss.meta}>
          Fastest, km {splits[fastestIdx].km}: <Text style={ss.metaStrong}>{formatPace(min)}</Text>
        </Text>
      </View>
      <View style={ss.rows}>
        {rows.map(s => {
          const fast = s.pace === min;
          const w = 35 + ((max - s.pace) / range) * 65;
          return (
            <View key={s.km} style={ss.row} accessibilityLabel={`Kilometre ${s.km}, ${formatPace(s.pace)} per km`}>
              <Text style={[ss.km, fast && { color: zone.own }]}>{s.km}</Text>
              <View style={ss.track}>
                <View style={[ss.bar, { width: `${w}%`, backgroundColor: fast ? zone.own : C.mint2 }]} />
              </View>
              <Text style={[ss.pace, fast && { color: zone.own }]}>{formatPace(s.pace)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:       { backgroundColor: C.card, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 16 },
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title:      { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    meta:       { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    metaStrong: { fontFamily: Fonts.semiBold, color: C.t1 },
    rows:       { marginTop: 12, gap: 8 },
    row:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
    km:         { width: 22, fontFamily: Fonts.medium, fontSize: 13, color: C.t2, fontVariant: ['tabular-nums'] },
    track:      { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.bg, overflow: 'hidden' },
    bar:        { height: 10, borderRadius: 5 },
    pace:       { width: 40, textAlign: 'right', fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1, fontVariant: ['tabular-nums'] },
  });
}
