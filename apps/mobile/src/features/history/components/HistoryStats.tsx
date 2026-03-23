import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = { white: '#FFF', border: '#DDD9D4', black: '#0A0A0A', t3: '#ADADAD' };

interface Props {
  runCount: number;
  totalKm: number;
  avgKm: number;
}

export function HistoryStats({ runCount, totalKm, avgKm }: Props) {
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

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  cell: { flex: 1, backgroundColor: C.white, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, padding: 12, alignItems: 'center' },
  value: { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: C.black },
  label: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, marginTop: 2 },
});
