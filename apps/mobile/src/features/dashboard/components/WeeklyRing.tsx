import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DayArcRing } from './DayArcRing';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  weeklyKm: number;
  goalKm:   number;
  runDays:  boolean[];
  onPress?: () => void;
}

function caption(weeklyKm: number, goalKm: number, ranToday: boolean): string {
  const pct = goalKm > 0 ? weeklyKm / goalKm : 0;
  if (pct >= 1) return 'Week’s done — go again anyway';
  if (ranToday) return 'Nice — today’s in the bank';
  if (pct >= 0.6) return 'Closing in on the week';
  if (weeklyKm === 0) return 'Nothing logged yet this week';
  return `${Math.max(0, goalKm - weeklyKm).toFixed(1)} km to go`;
}

export function WeeklyRing({ weeklyKm, goalKm, runDays, onPress }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <View style={ss.content}>
      <DayArcRing
        dayDone={runDays} todayIdx={todayIdx}
        accentColor={C.red} gradientId="weeklyRing"
        onPress={onPress}
      >
        <View style={ss.kmRow}>
          <Text style={ss.km}>{weeklyKm.toFixed(1)}</Text>
          <Text style={ss.kmUnit}>km</Text>
        </View>
        <Text style={ss.kmGoal}>of {goalKm}</Text>
      </DayArcRing>
      <Text style={ss.caption}>{caption(weeklyKm, goalKm, runDays[todayIdx])}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    content:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
    kmRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    km:       { fontFamily: Fonts.light, fontSize: 38, color: C.white, letterSpacing: -1.5, lineHeight: 40, fontVariant: ['tabular-nums'] },
    kmUnit:   { fontFamily: Fonts.light, fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
    kmGoal:   { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
    caption:  { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 20 },
  });
}
