import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Zap } from 'lucide-react-native';
import { usePostRunInsights } from '../hooks/usePostRunInsights';

const C = { black: '#0A0A0A', white: '#FFFFFF', purple: '#8B5CF6', border: '#DDD9D4', t3: '#A39E98' };
const FONT_MED   = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

interface PostRunInsightsCardProps {
  runId?: string;
  distance: number;
  pace: number;
  duration: number;
}

function ruleBasedInsight(distance: number, pace: number): string {
  if (distance >= 10) return `Great long run — ${distance.toFixed(1)} km is a serious effort. Prioritise recovery today.`;
  if (pace > 0 && pace < 5) return `Excellent pace of ${Math.floor(pace)}:${String(Math.floor((pace % 1) * 60)).padStart(2, '0')}/km — you were flying!`;
  if (distance >= 5) return `Solid ${distance.toFixed(1)} km run. Consistency like this builds real fitness.`;
  return `Every kilometre counts. Keep showing up and the results will follow.`;
}

export default function PostRunInsightsCard({ runId, distance, pace }: PostRunInsightsCardProps) {
  const { insights, loading } = usePostRunInsights(runId);

  return (
    <View style={ss.card}>
      <View style={ss.header}>
        <View style={ss.iconWrap}>
          <Zap size={14} color={C.purple} strokeWidth={1.5} />
        </View>
        <Text style={ss.title}>Run Insight</Text>
        {loading && <ActivityIndicator size="small" color={C.purple} style={{ marginLeft: 8 }} />}
      </View>

      {insights ? (
        <>
          <Text style={ss.body}>{insights.praise}</Text>
          <Text style={[ss.body, ss.bodyMuted]}>{insights.analysis}</Text>
          {insights.suggestion && (
            <Text style={[ss.body, ss.suggestion]}>💡 {insights.suggestion}</Text>
          )}
          {insights.recovery && (
            <Text style={[ss.body, ss.bodyMuted]}>🛌 {insights.recovery}</Text>
          )}
        </>
      ) : !loading ? (
        <Text style={ss.body}>{ruleBasedInsight(distance, pace)}</Text>
      ) : null}
    </View>
  );
}

const ss = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 12, padding: 14, backgroundColor: C.white, borderRadius: 4, borderWidth: 0.5, borderColor: C.border },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  iconWrap:   { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center' },
  title:      { fontFamily: FONT_MED, fontSize: 12, color: C.black },
  body:       { fontFamily: FONT_LIGHT, fontSize: 13, color: '#4B5563', lineHeight: 19, marginBottom: 4 },
  bodyMuted:  { color: C.t3, fontSize: 12 },
  suggestion: { color: '#1A6B40', fontSize: 12 },
});
