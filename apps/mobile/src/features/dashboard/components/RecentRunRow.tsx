import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import type { StoredRun } from '@shared/services/store';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

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
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
    rowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.mid },
    type:      { ...Type.overline, color: C.t2 },
    date:      { ...Type.caption, color: C.t3, marginTop: 2 },
    stats:     { flexDirection: 'row', gap: 16 },
    stat:      { alignItems: 'flex-end' },
    statValue: { ...Type.metricSm, fontFamily: Fonts.light, color: C.t1, lineHeight: 18 },
    statLabel: { ...Type.overline, color: C.t3, marginTop: 2 },
  });
}
