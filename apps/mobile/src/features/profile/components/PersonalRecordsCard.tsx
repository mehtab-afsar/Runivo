import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@theme';

const C = Colors;

interface PersonalRecord {
  label: string;
  value: string;
}

interface PersonalRecordsCardProps {
  records: PersonalRecord[];
}

export function PersonalRecordsCard({ records }: PersonalRecordsCardProps) {
  if (records.length === 0) {
    return <Text style={ss.emptyText}>Run more to unlock personal records.</Text>;
  }

  return (
    <View style={ss.grid}>
      {records.map(pr => (
        <View key={pr.label} style={ss.card}>
          <Text style={ss.prLabel}>{pr.label}</Text>
          <Text style={ss.prValue}>{pr.value}</Text>
        </View>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '47%',
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 12,
  },
  prLabel: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginBottom: 4 },
  prValue: { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: C.black },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
});
