import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  ownedCount: number;
  weakZones:  number;
  avgFreshness: number;
  totalAreaM2: number;
}

export function TerritoryStats({ ownedCount, weakZones, avgFreshness, totalAreaM2 }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const areaLabel = totalAreaM2 >= 1000
    ? `${(totalAreaM2 / 1000).toFixed(1)}k m²`
    : `${Math.round(totalAreaM2)} m²`;

  const stats = [
    { value: String(ownedCount),      label: 'ZONES OWNED',   color: C.t1 },
    { value: `${avgFreshness}%`,       label: 'AVG FRESHNESS', color: C.t1 },
    { value: areaLabel,                label: 'TOTAL AREA',    color: C.t1 },
    { value: String(weakZones),        label: 'WEAK ZONES',    color: weakZones > 0 ? C.red : C.t1 },
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    grid: {
      backgroundColor: C.white, borderRadius: 20,
      borderWidth: 0.5, borderColor: C.border,
      overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap',
    },
    cell: {
      width: '50%', padding: 16, paddingHorizontal: 20,
      borderBottomWidth: 0.5, borderBottomColor: C.mid,
    },
    cellBorderRight: { borderRightWidth: 0.5, borderRightColor: C.mid },
    value: { fontSize: 22, letterSpacing: -0.6, lineHeight: 24, marginBottom: 4 },
    label: { fontSize: 9, letterSpacing: 0.8, color: C.t3 },
  });
}
