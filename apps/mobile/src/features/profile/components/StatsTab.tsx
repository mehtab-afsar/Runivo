import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PersonalRecordsCard } from './PersonalRecordsCard';
import { StatRow } from './StatRow';
import { AwardsTab } from './AwardsTab';
import type { PersonalRecord } from '../hooks/useProfile';
import { Colors } from '@theme';

const C = Colors;

interface Props {
  personalRecords: PersonalRecord[];
  totalRuns: number;
  totalKm: number;
  totalTerritories: number;
  streakDays: number;
}

export function StatsTab({ personalRecords, totalRuns, totalKm, totalTerritories, streakDays }: Props) {
  const allTime = [
    { label: 'Total runs',  value: String(totalRuns) },
    { label: 'Total km',    value: totalKm.toFixed(1) },
    { label: 'Territories', value: String(totalTerritories) },
    { label: 'Streak',      value: `${streakDays}d` },
  ];

  return (
    <View>
      <Text style={ss.section}>Personal records</Text>
      <PersonalRecordsCard records={personalRecords} />
      <Text style={[ss.section, { marginTop: 20 }]}>All-time</Text>
      <View style={ss.grid}>
        {allTime.map(s => <StatRow key={s.label} label={s.label} value={s.value} />)}
      </View>
      <Text style={[ss.section, { marginTop: 20 }]}>Awards</Text>
      <AwardsTab />
    </View>
  );
}

const ss = StyleSheet.create({
  section: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
