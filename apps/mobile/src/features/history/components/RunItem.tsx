import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StoredRun } from '@shared/services/store';
import { fmtDist, fmtDuration, fmtShortDate } from '@mobile/shared/lib/formatters';

const C = { white: '#FFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', red: '#D93518' };

interface Props {
  run: StoredRun;
  onPress: () => void;
}

export function RunItem({ run, onPress }: Props) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={s.date}>{fmtShortDate(run.startTime)}</Text>
        <Text style={s.dist}>{fmtDist(run.distanceMeters)} km</Text>
      </View>
      <View style={{ gap: 4, alignItems: 'flex-end' }}>
        <Text style={s.pace}>{run.avgPace}/km</Text>
        <Text style={s.dur}>{fmtDuration(run.durationSec)}</Text>
        {run.territoriesClaimed.length > 0 && (
          <Text style={s.zones}>⚡ {run.territoriesClaimed.length}</Text>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center' },
  date: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, marginBottom: 2 },
  dist: { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: C.black },
  pace: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  dur: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
  zones: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.red },
});
