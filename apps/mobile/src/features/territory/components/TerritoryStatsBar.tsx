import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { formatArea } from '@shared/constants/territory';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';

interface Props {
  stats: {
    ownCount:       number;
    totalAreaM2:    number;
    avgFreshness:   number;
    staleCount:     number;
    rivalCount:     number;
    territoryScore: number;
  };
  isLoadingRivals: boolean;
  bottomInset:     number;
}

export function TerritoryStatsBar({ stats, isLoadingRivals, bottomInset }: Props) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);

  const cells: { value: string; label: string; color?: string }[] = [
    { value: Intl.NumberFormat().format(Math.round(stats.territoryScore)), label: 'Score' },
    { value: String(stats.ownCount), label: 'Zones', color: zone.own },
    { value: formatArea(stats.totalAreaM2), label: 'Ground' },
    { value: `${stats.avgFreshness}%`, label: 'Fresh' },
  ];

  return (
    <View style={[ss.container, { bottom: bottomInset + 8 }]}>
      <View style={ss.row}>
        {cells.map((c, i) => (
          <View key={c.label} style={[ss.cell, i > 0 && ss.cellDivider]}>
            <Text style={[ss.value, c.color ? { color: c.color } : null]} numberOfLines={1} adjustsFontSizeToFit>
              {c.value}
            </Text>
            <Text style={ss.label}>{c.label}</Text>
          </View>
        ))}
      </View>
      {(stats.staleCount > 0 || isLoadingRivals) && (
        <View style={ss.footer}>
          {stats.staleCount > 0 && (
            <View style={ss.staleRow}>
              <View style={[ss.staleDot, { backgroundColor: zone.ownFading }]} />
              <Text style={ss.staleText}>
                {stats.staleCount} {stats.staleCount === 1 ? 'zone is' : 'zones are'} fading
              </Text>
            </View>
          )}
          {isLoadingRivals && <ActivityIndicator size="small" color={C.t3} style={{ marginLeft: 'auto' }} />}
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container:   { position: 'absolute', left: 12, right: 12, backgroundColor: C.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 8, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    row:         { flexDirection: 'row' },
    cell:        { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    cellDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: C.border },
    value:       { fontFamily: Fonts.numeric, fontSize: 24, lineHeight: 26, color: C.t1 },
    label:       { fontFamily: Fonts.medium, fontSize: 11, color: C.t2, marginTop: 2 },
    footer:      { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    staleRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    staleDot:    { width: 8, height: 8, borderRadius: 4 },
    staleText:   { fontFamily: Fonts.medium, fontSize: 12, color: C.t1 },
  });
}
