import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StoredRun } from '@shared/services/store';
import { fmtDist, fmtDuration, fmtShortDate } from '@mobile/shared/lib/formatters';
import { useTheme, Fonts, type AppColors } from '@theme';

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
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
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

    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    activityBadge:{ fontFamily: Fonts.medium, fontSize: 11, color: C.t2 },
    date:        { fontFamily: Fonts.regular, fontSize: 10, color: C.t3 },
    dist:        { fontFamily: Fonts.semiBold, fontSize: 22, color: C.black, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    pills:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    pill:        { backgroundColor: C.stone, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: C.border },
    pillText:    { fontFamily: Fonts.regular, fontSize: 10, color: C.t2 },
    pillRed:     { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.2)' },
    pillTextRed: { color: C.red },
  });
}
