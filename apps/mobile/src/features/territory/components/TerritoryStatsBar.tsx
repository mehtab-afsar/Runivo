import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { formatArea } from '@shared/constants/territory';

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
  return (
    <View style={[ss.container, { bottom: bottomInset + 8 }]}>
      <Text style={ss.row1}>
        {stats.ownCount} zones · {formatArea(stats.totalAreaM2)} · {stats.avgFreshness}% fresh
      </Text>
      <View style={ss.row2}>
        <Text style={ss.tsLabel}>TS </Text>
        <Text style={ss.tsVal}>{Intl.NumberFormat().format(Math.round(stats.territoryScore))}</Text>
        {stats.staleCount > 0 && (
          <Text style={ss.stale}>  ⚠ {stats.staleCount} stale</Text>
        )}
        {isLoadingRivals && (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginLeft: 8 }} />
        )}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.70)', borderRadius: 12, padding: 12 },
  row1:      { fontWeight: '500', fontSize: 13, color: '#fff', marginBottom: 2 },
  row2:      { flexDirection: 'row', alignItems: 'center' },
  tsLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  tsVal:     { fontWeight: '500', fontSize: 13, color: '#fff' },
  stale:     { fontWeight: '500', fontSize: 13, color: '#EF9F27' },
});
