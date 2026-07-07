import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@theme';

interface InsightStat {
  label: string;
  value: string;
}

interface InsightData {
  headline?: string;
  insights?: string[];
  tip?:      string;
  stats?:    InsightStat[];
  text?:     string;
}

interface Props {
  type:    string;
  content: string;
}

export function CoachMessageCard({ type, content }: Props) {
  if (type === 'insight') {
    let data: InsightData = {};
    try { data = JSON.parse(content); } catch { /* fall through to raw text */ }

    return (
      <View style={ss.card}>
        {data.headline && <Text style={ss.headline}>{data.headline}</Text>}
        {data.insights?.map((ins, i) => (
          <View key={i} style={ss.insightRow}>
            <View style={ss.dot} />
            <Text style={ss.insightText}>{ins}</Text>
          </View>
        ))}
        {data.stats?.map((s, i) => (
          <View key={i} style={ss.statRow}>
            <Text style={ss.statValue}>{s.value}</Text>
            <Text style={ss.statLabel}>{s.label}</Text>
          </View>
        ))}
        {data.tip && (
          <View style={ss.tipBox}>
            <Text style={ss.tipText}>💡 {data.tip}</Text>
          </View>
        )}
        {!data.headline && !data.insights && !data.stats && (
          <Text style={ss.rawText}>{content}</Text>
        )}
      </View>
    );
  }

  return <Text style={ss.rawText}>{content}</Text>;
}

const ss = StyleSheet.create({
  card:        { backgroundColor: Colors.white, borderRadius: 14, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#DDD9D4', padding: 14, maxWidth: '85%' },
  headline:    { fontFamily: Fonts.medium, fontSize: 14, color: Colors.alwaysDark, marginBottom: 10 },
  insightRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  dot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.purple, marginTop: 6, flexShrink: 0 },
  insightText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.alwaysDark, lineHeight: 20, flex: 1 },
  statRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  statValue:   { fontFamily: Fonts.medium, fontSize: 18, color: Colors.alwaysDark, fontVariant: ['tabular-nums'] },
  statLabel:   { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(10,10,10,0.5)' },
  tipBox:      { marginTop: 10, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 8, padding: 10 },
  tipText:     { fontFamily: Fonts.regular, fontSize: 12, color: Colors.alwaysDark, lineHeight: 18 },
  rawText:     { fontFamily: Fonts.regular, fontSize: 13, color: Colors.alwaysDark, lineHeight: 20 },
});
