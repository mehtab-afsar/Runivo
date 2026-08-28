import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowRight, Lightning } from 'phosphor-react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import type { WeeklyBriefPayload } from '../services/coachService';

interface Props {
  brief:          WeeklyBriefPayload | null;
  loading:        boolean;
  onAskFollowUp:  () => void;
  onBuildPlan:    () => void;
  onStartRun:     () => void;
}

function PaceXLogo({ size = 22 }: { size?: number }) {
  const C = useTheme();
  return (
    <Text>
      <Text style={{ fontFamily: Fonts.semiBold, fontSize: size, color: C.black }}>Pace</Text>
      <Text style={{ fontFamily: Fonts.bold, fontSize: size + 1, color: C.red }}>X</Text>
    </Text>
  );
}

export function CoachBrief({ brief, loading, onAskFollowUp, onBuildPlan, onStartRun }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  if (loading || !brief) {
    return (
      <View style={s.loaderWrap}>
        <ActivityIndicator color={C.red} />
      </View>
    );
  }

  const coldStart = brief.insights.length === 0;

  return (
    <View style={s.wrap}>
      <View style={s.wordmarkRow}>
        <PaceXLogo size={20} />
      </View>

      {coldStart ? (
        <View style={s.card}>
          <Text style={s.eyebrow}>READY WHEN YOU ARE</Text>
          <Text style={s.headline}>{brief.headline}</Text>
          <Text style={s.tip}>{brief.tip}</Text>
          <Pressable style={[s.primaryBtn, { backgroundColor: C.alwaysDark }]} onPress={onStartRun}>
            <Text style={s.primaryBtnLabel}>Start your first run</Text>
            <ArrowRight size={14} color={C.alwaysLight} weight="regular" />
          </Pressable>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.eyebrow}>SINCE YOUR LAST FEW RUNS</Text>
          <Text style={s.headline}>{brief.headline}</Text>
          {brief.insights.map((ins, i) => (
            <View key={i} style={s.insightRow}>
              <View style={[s.dot, { backgroundColor: C.purple }]} />
              <Text style={s.insightText}>{ins}</Text>
            </View>
          ))}
          <View style={[s.actionRow, { backgroundColor: C.stone }]}>
            <Lightning size={14} color={C.red} weight="fill" />
            <Text style={s.actionText}>{brief.tip}</Text>
          </View>
        </View>
      )}

      <View style={s.secondaryRow}>
        <Pressable style={[s.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface }]} onPress={onAskFollowUp}>
          <Text style={[s.secondaryBtnLabel, { color: C.t2 }]}>Ask a follow-up</Text>
        </Pressable>
        <Pressable onPress={onBuildPlan} hitSlop={8}>
          <Text style={[s.planLink, { color: C.t3 }]}>Build a training plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    loaderWrap:      { paddingTop: 80, alignItems: 'center' },
    wrap:            { paddingHorizontal: Spacing.gutter, paddingTop: 24, gap: 16 },
    wordmarkRow:     { alignItems: 'center', marginBottom: 4 },
    card:            { backgroundColor: C.card, borderRadius: 16, padding: 18, gap: 10, borderWidth: 0.5, borderColor: C.border },
    eyebrow:         { ...Type.overline, color: C.t3, letterSpacing: 1.4 },
    headline:        { fontFamily: Fonts.display, fontSize: 24, lineHeight: 29, color: C.black, marginBottom: 2 },
    tip:             { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, lineHeight: 20 },
    insightRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    dot:             { width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0 },
    insightText:     { fontFamily: Fonts.regular, fontSize: 13.5, color: C.t1, lineHeight: 19, flex: 1 },
    actionRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginTop: 4 },
    actionText:      { fontFamily: Fonts.medium, fontSize: 13, color: C.black, flex: 1, lineHeight: 18 },
    primaryBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 12, marginTop: 4 },
    primaryBtnLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    secondaryRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    secondaryBtn:    { flex: 1, borderRadius: 10, borderWidth: 0.5, paddingVertical: 11, alignItems: 'center', marginRight: 12 },
    secondaryBtnLabel: { fontFamily: Fonts.medium, fontSize: 13 },
    planLink:        { fontFamily: Fonts.regular, fontSize: 12, textDecorationLine: 'underline' },
  });
}
