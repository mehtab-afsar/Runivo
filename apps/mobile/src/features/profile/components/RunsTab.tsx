import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StoredRun } from '@shared/services/store';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import { Colors } from '@theme';

const C = Colors;

interface Props {
  runs: StoredRun[];
}

export function RunsTab({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <View style={ss.empty}>
        <Text style={ss.emptyTitle}>No runs yet</Text>
        <Text style={ss.emptyText}>Complete your first run to see stats here.</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={ss.sectionTitle}>Recent runs</Text>
      {runs.slice(0, 10).map(run => (
        <View key={run.id} style={ss.runRow}>
          <View style={{ flex: 1 }}>
            <Text style={ss.runDate}>
              {new Date(run.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={ss.runDist}>{fmtDist(run.distanceMeters)} km</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={ss.runPace}>{run.avgPace}/km</Text>
            <Text style={ss.runTime}>{fmtDuration(run.durationSec)}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const ss = StyleSheet.create({
  sectionTitle: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
  },
  runRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  runDate: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, marginBottom: 2 },
  runDist: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: C.black },
  runPace: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  runTime: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
});
