import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Fonts, useTheme, type AppColors } from '@theme';

interface InsightStat {
  label: string;
  value: string;
}

interface InsightData {
  headline?:   string;
  insights?:   string[];
  tip?:        string;
  stats?:      InsightStat[];
  text?:       string;
  // post_run shape
  praise?:     string;
  analysis?:   string;
  suggestion?: string;
  recovery?:   string;
}

interface Props {
  type:    string;
  content: string;
  /** Overrides the card's own maxWidth:'85%' (sized for chat-bubble layout,
   *  where an avatar sits beside it) — pass e.g. { maxWidth: '100%' } when
   *  reusing this card full-width outside the chat feed. */
  style?: ViewStyle;
}

export function CoachMessageCard({ type, content, style }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  if (type === 'insight') {
    let data: InsightData = {};
    try { data = JSON.parse(content); } catch { /* fall through to raw text */ }

    return (
      <View style={[ss.card, style]}>
        {data.praise && <Text style={ss.praise}>{data.praise}</Text>}
        {data.headline && <Text style={ss.headline}>{data.headline}</Text>}
        {data.insights?.map((ins, i) => (
          <View key={i} style={ss.insightRow}>
            <View style={ss.dot} />
            <Text style={ss.insightText}>{ins}</Text>
          </View>
        ))}
        {data.analysis && (
          <View style={ss.insightRow}>
            <View style={ss.dot} />
            <Text style={ss.insightText}>{data.analysis}</Text>
          </View>
        )}
        {data.stats?.map((s, i) => (
          <View key={i} style={ss.statRow}>
            <Text style={ss.statValue}>{s.value}</Text>
            <Text style={ss.statLabel}>{s.label}</Text>
          </View>
        ))}
        {data.suggestion && (
          <View style={ss.actionBox}>
            <Text style={ss.actionText}>{data.suggestion}</Text>
          </View>
        )}
        {data.recovery && (
          <View style={ss.actionBox}>
            <Text style={ss.actionText}>{data.recovery}</Text>
          </View>
        )}
        {data.tip && (
          <View style={ss.tipBox}>
            <Text style={ss.tipText}>💡 {data.tip}</Text>
          </View>
        )}
        {!data.praise && !data.headline && !data.insights && !data.analysis && !data.stats && (
          <Text style={ss.rawText}>{content}</Text>
        )}
      </View>
    );
  }

  return <Text style={ss.rawText}>{content}</Text>;
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { backgroundColor: C.card, borderRadius: 14, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: C.border, padding: 14, maxWidth: '85%' },
    praise:      { fontFamily: Fonts.display, fontSize: 16, color: C.t1, lineHeight: 21, marginBottom: 8 },
    headline:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t1, marginBottom: 10 },
    insightRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    dot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: C.purple, marginTop: 6, flexShrink: 0 },
    insightText: { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, lineHeight: 20, flex: 1 },
    statRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
    statValue:   { fontFamily: Fonts.medium, fontSize: 18, color: C.t1, fontVariant: ['tabular-nums'] },
    statLabel:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },
    actionBox:   { marginTop: 8, backgroundColor: C.stone, borderRadius: 8, padding: 10 },
    actionText:  { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1, lineHeight: 18 },
    tipBox:      { marginTop: 10, backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 8, padding: 10 },
    tipText:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t1, lineHeight: 18 },
    rawText:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, lineHeight: 20 },
  });
}
