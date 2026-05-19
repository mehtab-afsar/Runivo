import React, { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Fire, Diamond } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, type AppColors } from '@theme';

interface Props {
  runnerRank?: string;
  paceWeeklyEarned: number;
  weeklyCapLimit: number;
  streakDays: number;
}

export function DashboardPills({ runnerRank = 'pacer', paceWeeklyEarned, weeklyCapLimit, streakDays }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const rank = runnerRank.charAt(0).toUpperCase() + runnerRank.slice(1);
  const barPct = Math.min(100, weeklyCapLimit > 0 ? (paceWeeklyEarned / weeklyCapLimit) * 100 : 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ss.row}
    >
      {/* Runner rank */}
      <Pressable onPress={tap} style={ss.pill}>
        <Diamond size={11} color={C.red} weight="light" />
        <Text style={ss.pillV}>{rank}</Text>
      </Pressable>

      {/* Weekly PACE progress */}
      <Pressable onPress={tap} style={[ss.pill, ss.pacePill]}>
        <Text style={ss.pillV}>{paceWeeklyEarned} / {weeklyCapLimit}</Text>
        <Text style={ss.pillL}> PACE</Text>
        <View style={ss.barBg}>
          <View style={[ss.barFill, { width: `${barPct}%` as any }]} />
        </View>
      </Pressable>

      {/* Streak — always shown */}
      <Pressable onPress={tap} style={ss.pill}>
        <Fire size={13} color={streakDays > 0 ? C.red : C.t3} weight="light" />
        <Text style={ss.pillV}>{streakDays}</Text>
        <Text style={ss.pillL}>{streakDays === 1 ? 'day' : 'days'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', gap: 6, paddingHorizontal: 22, paddingBottom: 20 },
    pill:      { height: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border, borderRadius: 20 },
    pacePill:  { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 7, height: 'auto' as any, gap: 0 },
    paceRow:   { flexDirection: 'row', alignItems: 'center' },
    barBg:     { width: 90, height: 2, borderRadius: 1, backgroundColor: C.border, marginTop: 4 },
    barFill:   { height: '100%', borderRadius: 1, backgroundColor: C.red },
    pillV:     { fontWeight: '500', fontSize: 12, color: C.black },
    pillL:     { fontSize: 11, color: C.t3 },
  });
}
