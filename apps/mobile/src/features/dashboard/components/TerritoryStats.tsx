import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  ownedCount: number;
  weakZones:  number;
  avgFreshness: number;
  totalAreaM2: number;
}

export function TerritoryStats({ ownedCount, weakZones, avgFreshness, totalAreaM2 }: Props) {
  const areaLabel = totalAreaM2 >= 1000
    ? `${(totalAreaM2 / 1000).toFixed(1)}k m²`
    : `${Math.round(totalAreaM2)} m²`;

  const stats = [
    { value: String(ownedCount),      label: 'ZONES OWNED',   color: '#0A0A0A' },
    { value: `${avgFreshness}%`,       label: 'AVG FRESHNESS', color: '#0A0A0A' },
    { value: areaLabel,                label: 'TOTAL AREA',    color: '#0A0A0A' },
    { value: String(weakZones),        label: 'WEAK ZONES',    color: weakZones > 0 ? '#D93518' : '#0A0A0A' },
  ];

  return (
    <View style={ss.grid}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={[ss.cell, i % 2 === 0 && ss.cellBorderRight]}
        >
          <Text style={[ss.value, { color: s.color }]}>{s.value}</Text>
          <Text style={ss.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  grid: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 0.5, borderColor: '#DDD9D4',
    overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap',
  },
  cell: {
    width: '50%', padding: 16, paddingHorizontal: 20,
    borderBottomWidth: 0.5, borderBottomColor: '#E8E4DF',
  },
  cellBorderRight: { borderRightWidth: 0.5, borderRightColor: '#E8E4DF' },
  value: { fontSize: 22, letterSpacing: -0.6, lineHeight: 24, marginBottom: 4 },
  label: { fontSize: 9, letterSpacing: 0.8, color: '#ADADAD' },
});
