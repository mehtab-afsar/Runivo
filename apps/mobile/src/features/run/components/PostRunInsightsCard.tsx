import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Lightning, Lightbulb, Bed as BedDouble } from 'phosphor-react-native';
import { usePostRunInsights } from '../hooks/usePostRunInsights';
import { GAME_CONFIG } from '@shared/services/config';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface PostRunInsightsCardProps {
  runId?: string;
  distance: number;
  pace: number;
  duration: number;
}

function ruleBasedInsight(distance: number, pace: number, durationSec: number): string {
  // Matches the minimum-effort threshold in useGameEngine.ts's endRunSession — a run
  // this short shouldn't get generic encouragement, it should say what actually happened.
  if (distance * 1000 < GAME_CONFIG.MIN_MEANINGFUL_RUN_DISTANCE_M && durationSec < GAME_CONFIG.MIN_MEANINGFUL_RUN_DURATION_S) {
    return `This run didn't record any real distance — check that location services are on and try again outdoors.`;
  }
  if (distance >= 10) return `Great long run — ${distance.toFixed(1)} km is a serious effort. Prioritise recovery today.`;
  if (pace > 0 && pace < 5) return `Excellent pace of ${Math.floor(pace)}:${String(Math.floor((pace % 1) * 60)).padStart(2, '0')}/km — you were flying!`;
  if (distance >= 5) return `Solid ${distance.toFixed(1)} km run. Consistency like this builds real fitness.`;
  return `Every kilometre counts. Keep showing up and the results will follow.`;
}

export default function PostRunInsightsCard({ runId, distance, pace, duration }: PostRunInsightsCardProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const { insights, loading } = usePostRunInsights(runId);

  return (
    <View style={ss.card}>
      <View style={ss.header}>
        <View style={ss.iconWrap}>
          <Lightning size={14} color={C.purple} weight="light" />
        </View>
        <Text style={ss.title}>Run Insight</Text>
        {loading && <ActivityIndicator size="small" color={C.purple} style={{ marginLeft: 8 }} />}
      </View>

      {insights ? (
        <>
          <Text style={ss.body}>{insights.praise}</Text>
          <Text style={[ss.body, ss.bodyMuted]}>{insights.analysis}</Text>
          {insights.suggestion && (
            <Text style={[ss.body, ss.suggestion]}><Lightbulb size={11} color={C.green} weight="light" /> {insights.suggestion}</Text>
          )}
          {insights.recovery && (
            <Text style={[ss.body, ss.bodyMuted]}><BedDouble size={11} color={C.t3} weight="light" /> {insights.recovery}</Text>
          )}
        </>
      ) : !loading ? (
        <Text style={ss.body}>{ruleBasedInsight(distance, pace, duration)}</Text>
      ) : null}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:       { marginHorizontal: Spacing.gutter, marginBottom: 12, padding: 14, backgroundColor: C.card, borderRadius: 4, borderWidth: 0.5, borderColor: C.border },
    header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    iconWrap:   { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center' },
    title:      { fontFamily: Fonts.medium, fontSize: 12, color: C.black },
    body:       { fontFamily: Fonts.light, fontSize: 13, color: C.t2, lineHeight: 19, marginBottom: 4 },
    bodyMuted:  { color: C.t3, fontSize: 12 },
    suggestion: { color: C.green, fontSize: 12 },
  });
}
