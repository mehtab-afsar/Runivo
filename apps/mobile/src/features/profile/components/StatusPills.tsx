import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StoredRun } from '@shared/services/store';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  streakDays: number;
  weekPace: number;
  runs: StoredRun[];
}

export function StatusPills({ streakDays, weekPace, runs }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const consistency = useMemo(() => {
    const now = Date.now();
    const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000;
    const uniqueDays = new Set<string>();
    for (const r of runs) {
      if (r.startTime >= twentyEightDaysAgo) {
        const d = new Date(r.startTime);
        uniqueDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    return Math.round((uniqueDays.size / 28) * 100);
  }, [runs]);

  return (
    <View style={s.row}>
      <View style={s.pill}>
        <Text style={s.pillIcon}>🔥</Text>
        <Text style={s.pillValue}>{streakDays}</Text>
        <Text style={s.pillLabel}>streak</Text>
      </View>
      <View style={s.pill}>
        <Text style={s.pillIcon}>⚡</Text>
        <Text style={s.pillValue}>{weekPace}</Text>
        <Text style={s.pillLabel}>PACE this wk</Text>
      </View>
      <View style={s.pill}>
        <Text style={s.pillIcon}>📊</Text>
        <Text style={s.pillValue}>{consistency}%</Text>
        <Text style={s.pillLabel}>active days</Text>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    pill: {
      flex: 1,
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: C.border,
      padding: 12,
      alignItems: 'center',
    },
    pillIcon: { fontSize: 16, marginBottom: 4 },
    pillValue: { fontFamily: Fonts.semiBold, fontSize: 18, color: C.black, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    pillLabel: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginTop: 2 },
  });
}
