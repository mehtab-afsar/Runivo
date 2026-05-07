import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StoredRun } from '@shared/services/store';
import { fmtDist, fmtDuration, fmtShortDate } from '@mobile/shared/lib/formatters';
import { Colors } from '@theme';

const C = Colors;

const ACTIVITY_LABELS: Record<string, { emoji: string; label: string }> = {
  run:       { emoji: '🏃', label: 'Run' },
  walk:      { emoji: '🚶', label: 'Walk' },
  hike:      { emoji: '⛰️', label: 'Hike' },
  trail_run: { emoji: '🌲', label: 'Trail' },
  cycle:     { emoji: '🚴', label: 'Cycle' },
  interval:  { emoji: '⚡', label: 'Interval' },
  tempo:     { emoji: '💨', label: 'Tempo' },
  race:      { emoji: '🏅', label: 'Race' },
  long_run:  { emoji: '📏', label: 'Long Run' },
};

interface Props {
  run: StoredRun;
  onPress: () => void;
}

export function RunItem({ run, onPress }: Props) {
  const activity = ACTIVITY_LABELS[run.activityType] ?? { emoji: '🏃', label: run.activityType };
  const claimedCount = run.territoriesClaimed.length;

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Left column */}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={s.topRow}>
          <Text style={s.activityBadge}>{activity.emoji} {activity.label}</Text>
          <Text style={s.date}>{fmtShortDate(run.startTime)}</Text>
        </View>
        <Text style={s.dist}>{fmtDist(run.distanceMeters)} km</Text>
        <View style={s.pills}>
          <View style={s.pill}><Text style={s.pillText}>{fmtDuration(run.durationSec)}</Text></View>
          <View style={s.pill}><Text style={s.pillText}>{run.avgPace}/km</Text></View>
          {claimedCount > 0 && (
            <View style={[s.pill, s.pillRed]}><Text style={[s.pillText, s.pillTextRed]}>⚡ {claimedCount}</Text></View>
          )}
        </View>
      </View>

      {/* XP badge */}
      {run.xpEarned > 0 && (
        <View style={s.xpBadge}>
          <Text style={s.xpText}>+{run.xpEarned}</Text>
          <Text style={s.xpLabel}>XP</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityBadge:{ fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.t2 },
  date:        { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  dist:        { fontFamily: 'Barlow_600SemiBold', fontSize: 22, color: C.black, letterSpacing: -0.5 },
  pills:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill:        { backgroundColor: C.stone, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: C.border },
  pillText:    { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t2 },
  pillRed:     { backgroundColor: '#FDE8E4', borderColor: 'rgba(217,53,24,0.2)' },
  pillTextRed: { color: C.red },
  xpBadge:    { alignItems: 'center', backgroundColor: '#F9F5F0', borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8 },
  xpText:     { fontFamily: 'Barlow_700Bold', fontSize: 14, color: C.black },
  xpLabel:    { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3, letterSpacing: 0.5 },
});
