import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Sparkles, Lock, ChevronRight } from 'lucide-react-native';
import { usePostRunInsights } from '../hooks/usePostRunInsights';
import { buildRunSummary, type RunSummaryInput } from '@shared/engine/runSummary';
import { DEBRIEF_PAYWALL_AFTER_RUNS } from '@shared/engine/entitlements';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import AiConsentCard from '../../coach/components/AiConsentCard';
import { useAiConsent } from '../../coach/hooks/useAiConsent';

interface Props {
  runId?: string;
  plus: boolean;
  runsCompleted: number;
  summary: RunSummaryInput;
  onOpenPlus: () => void;
}

/**
 * PaceX after a run. Free: a summary built from the runner's own numbers (no
 * AI), plus a way into the full debrief from their third run. Plus: the full
 * AI debrief, falling back to the summary while it loads or if it fails.
 */
export default function PaceXSummaryCard({ runId, plus, runsCompleted, summary, onOpenPlus }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  // The AI debrief sends this run to a third-party AI, so it waits for the runner's say-so.
  const { consent, granted } = useAiConsent();
  const aiOn = plus && consent === true;
  const { insights, loading } = usePostRunInsights(runId, aiOn);
  const free = useMemo(() => buildRunSummary(summary), [summary]);
  const showUpsell = !plus && runsCompleted >= DEBRIEF_PAYWALL_AFTER_RUNS;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}><Sparkles size={15} color={C.red} strokeWidth={2.2} /></View>
        <Text style={s.title}>{plus ? 'PaceX debrief' : 'PaceX summary'}</Text>
        {aiOn && loading && <ActivityIndicator size="small" color={C.t3} style={{ marginLeft: 'auto' }} />}
      </View>

      {aiOn && insights ? (
        <>
          <Text style={s.lead}>{insights.praise}</Text>
          <Text style={s.body}>{insights.analysis}</Text>
          {!!insights.suggestion && <Text style={s.body}>{insights.suggestion}</Text>}
          {!!insights.recovery && <Text style={s.body}>{insights.recovery}</Text>}
        </>
      ) : (
        <>
          <Text style={s.lead}>{free.headline}</Text>
          {free.lines.map(line => <Text key={line} style={s.body}>{line}</Text>)}
        </>
      )}

      {plus && consent === false && (
        <View style={s.consent}><AiConsentCard compact onGranted={granted} /></View>
      )}

      {showUpsell && (
        <Pressable onPress={onOpenPlus} style={s.upsell} accessibilityRole="button">
          <Lock size={14} color={C.t1} strokeWidth={2.2} />
          <Text style={s.upsellText}>Full PaceX debrief</Text>
          <Text style={s.upsellTag}>Plus</Text>
          <ChevronRight size={16} color={C.t2} style={{ marginLeft: 'auto' }} />
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:       { marginHorizontal: Spacing.gutter, marginBottom: 12, padding: 16, backgroundColor: C.card, borderRadius: Spacing.radius.lg },
    head:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    icon:       { width: 28, height: 28, borderRadius: 8, backgroundColor: C.redLo, alignItems: 'center', justifyContent: 'center' },
    title:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    lead:       { fontFamily: Fonts.semiBold, fontSize: 16, lineHeight: 22, color: C.t1, marginBottom: 6 },
    body:       { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginTop: 4 },
    consent:    { marginTop: 14 },
    upsell:     {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
    },
    upsellText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    upsellTag:  { fontFamily: Fonts.semiBold, fontSize: 11, color: C.red, backgroundColor: C.redLo, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  });
}
