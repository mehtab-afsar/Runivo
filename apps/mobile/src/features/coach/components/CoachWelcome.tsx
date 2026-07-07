import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { ArrowRight } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

const PLAN_TEMPLATES = [
  'Run a 5K in 4 weeks',
  'Run a 10K in 8 weeks',
  'Run consistently 3x per week',
  'Build up to a half marathon',
  'Improve my pace by 30 seconds/km',
  'Run 4 weeks to lose weight',
];

interface Props {
  goalInput: string;
  onGoalChange: (v: string) => void;
  onGenerate: () => void;
  planLoading: boolean;
  onOpenChat: () => void;
}

export function CoachWelcome({ goalInput, onGoalChange, onGenerate, planLoading, onOpenChat }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={s.wrap}>
      {/* PaceX wordmark */}
      <Text style={s.wordmark}>
        <Text style={s.pace}>Pace</Text>
        <Text style={s.x}>X</Text>
      </Text>
      <Text style={s.tagline}>Your running coach and territory strategist.</Text>

      {/* Plan goal card */}
      <View style={s.card}>
        <Text style={s.cardHint}>Tell me your goal and I'll build your first training plan.</Text>
        <TextInput
          style={[s.input, { borderColor: C.border, color: C.black }]}
          value={goalInput}
          onChangeText={onGoalChange}
          placeholder="e.g. Run a 10K in 8 weeks"
          placeholderTextColor={C.t3}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />

        {/* Quick-fill templates */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.templatesScroll} contentContainerStyle={s.templatesContent}>
          {PLAN_TEMPLATES.map(t => (
            <Pressable
              key={t}
              style={({ pressed }) => [s.templateChip, { borderColor: C.border, backgroundColor: pressed ? C.mid : C.bg }]}
              onPress={() => onGoalChange(t)}
            >
              <Text style={[s.templateText, { color: C.t2 }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          style={[s.genBtn, { backgroundColor: C.alwaysDark }, (!goalInput.trim() || planLoading) && s.genBtnDisabled]}
          onPress={onGenerate}
          disabled={!goalInput.trim() || planLoading}
        >
          {planLoading ? (
            <ActivityIndicator color={C.alwaysLight} size="small" />
          ) : (
            <>
              <Text style={s.genBtnLabel}>Generate plan</Text>
              <ArrowRight size={14} color={C.alwaysLight} weight="regular" />
            </>
          )}
        </Pressable>
      </View>

      <View style={s.dividerRow}>
        <View style={[s.divider, { backgroundColor: C.border }]} />
        <Text style={[s.dividerText, { color: C.t3 }]}>OR</Text>
        <View style={[s.divider, { backgroundColor: C.border }]} />
      </View>

      {/* Quick chat */}
      <Pressable style={[s.chatBtn, { borderColor: C.border, backgroundColor: C.surface }]} onPress={onOpenChat}>
        <Text style={[s.chatBtnLabel, { color: C.t2 }]}>Ask me anything…</Text>
        <ArrowRight size={14} color={C.t3} weight="light" />
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:         { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 20, gap: 16 },
    wordmark:     { textAlign: 'center' },
    pace:         { fontFamily: Fonts.display, fontSize: 36, color: C.black },
    x:            { fontFamily: Fonts.bold, fontSize: 36, color: C.red },
    tagline:      { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, textAlign: 'center' },
    card:         { backgroundColor: C.white, borderRadius: 14, padding: 18, gap: 12, borderWidth: 0.5, borderColor: C.border },
    cardHint:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 18 },
    input:        { fontFamily: Fonts.regular, fontSize: 14, borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg },
    templatesScroll:  { marginHorizontal: -2 },
    templatesContent: { paddingHorizontal: 2, gap: 6, flexDirection: 'row' },
    templateChip:     { borderRadius: 16, borderWidth: 0.5, paddingHorizontal: 10, paddingVertical: 6 },
    templateText:     { fontFamily: Fonts.regular, fontSize: 12 },
    genBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 12 },
    genBtnDisabled: { opacity: 0.45 },
    genBtnLabel:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
    divider:      { flex: 1, height: 0.5 },
    dividerText:  { fontFamily: Fonts.regular, fontSize: 11, letterSpacing: 0.5 },
    chatBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 12 },
    chatBtnLabel: { fontFamily: Fonts.regular, fontSize: 14 },
  });
}
