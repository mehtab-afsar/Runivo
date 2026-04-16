import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  ownedCount: number;
  enemyCount: number;
  freeCount:  number;
}

export function TerritoryStatsBar({ ownedCount, enemyCount, freeCount }: Props) {
  const stats = [
    { dot: '#D93518', value: ownedCount, label: 'owned' },
    { dot: '#DC2626', value: enemyCount, label: 'enemy' },
    { dot: '#ADADAD', value: freeCount,  label: 'free'  },
  ];

  return (
    <View style={ss.row}>
      {stats.map(({ dot, value, label }) => (
        <View key={label} style={ss.chip}>
          <View style={[ss.dot, { backgroundColor: dot }]} />
          <Text style={ss.val}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  val:  { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#0A0A0A' },
});
