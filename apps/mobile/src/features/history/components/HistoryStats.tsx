import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface Props {
  runCount: number;
  totalKm: number;
  avgKm: number;
}

export function HistoryStats({ runCount, totalKm, avgKm }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const items = [
    { value: String(runCount), label: 'Runs' },
    { value: totalKm.toFixed(1), label: 'Total km' },
    { value: avgKm.toFixed(1), label: 'Avg km' },
  ];
  return (
    <View style={s.row}>
      {items.map(item => (
        <View key={item.label} style={s.cell}>
          <Text style={s.value}>{item.value}</Text>
          <Text style={s.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', paddingHorizontal: Spacing.gutter, gap: 8, marginBottom: 8 },
    cell: { flex: 1, backgroundColor: C.white, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, padding: 12, alignItems: 'center' },
    value: { fontFamily: Fonts.semiBold, fontSize: 18, color: C.black, fontVariant: ['tabular-nums'] },
    label: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginTop: 2 },
  });
}
