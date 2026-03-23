import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import type { StoredRun } from '@shared/services/store';

interface Props {
  run:     StoredRun;
  isLast?: boolean;
  onPress: (run: StoredRun) => void;
}

function relativeDate(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentRunRow({ run, isLast, onPress }: Props) {
  return (
    <Pressable
      style={[ss.row, !isLast && ss.rowBorder]}
      onPress={() => onPress(run)}
    >
      <View style={{ flex: 1 }}>
        <Text style={ss.type}>{(run.activityType ?? 'run').toUpperCase()}</Text>
        <Text style={ss.date}>{relativeDate(run.startTime)}</Text>
      </View>
      <View style={ss.stats}>
        <View style={ss.stat}>
          <Text style={ss.statValue}>{fmtDist(run.distanceMeters)}</Text>
          <Text style={ss.statLabel}>KM</Text>
        </View>
        <View style={ss.stat}>
          <Text style={ss.statValue}>{fmtDuration(Math.round(run.durationSec))}</Text>
          <Text style={ss.statLabel}>TIME</Text>
        </View>
      </View>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#E8E4DF' },
  type:      { fontFamily: 'Barlow_500Medium', fontSize: 10, color: '#6B6B6B', letterSpacing: 0.6 },
  date:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#ADADAD', marginTop: 2 },
  stats:     { flexDirection: 'row', gap: 16 },
  stat:      { alignItems: 'flex-end' },
  statValue: { fontFamily: 'Barlow_300Light', fontSize: 16, color: '#0A0A0A', letterSpacing: -0.3, lineHeight: 18 },
  statLabel: { fontFamily: 'Barlow_400Regular', fontSize: 8, color: '#ADADAD', letterSpacing: 0.6, marginTop: 2 },
});
