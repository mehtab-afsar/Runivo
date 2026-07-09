import React, { useMemo } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Fonts, useTheme, type AppColors } from '@theme';
import type { TrainingPlan } from '../services/coachService';

interface Props {
  plan:         TrainingPlan | null;
  open:         boolean;
  onToggle:     () => void;
  goalInput:    string;
  onGoalChange: (v: string) => void;
  onGenerate:   () => void;
  loading:      boolean;
}

export function TrainingPlanAccordion({ plan, open, onToggle, goalInput, onGoalChange, onGenerate, loading }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.container}>
      <Pressable style={ss.header} onPress={onToggle}>
        <Text style={ss.title}>Training Plan</Text>
        <Text style={ss.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {open && (
        <View style={ss.body}>
          <View style={ss.inputRow}>
            <TextInput
              style={ss.input}
              value={goalInput}
              onChangeText={onGoalChange}
              placeholder="e.g. Run a 5K in 30 min"
              placeholderTextColor={C.t3}
            />
            <Pressable style={[ss.genBtn, loading && ss.genBtnDisabled]} onPress={onGenerate} disabled={loading}>
              {loading
                ? <ActivityIndicator size="small" color={C.alwaysLight} />
                : <Text style={ss.genLabel}>Generate</Text>}
            </Pressable>
          </View>

          {plan?.weeks?.map(week => (
            <View key={week.week} style={ss.week}>
              <Text style={ss.weekTitle}>Week {week.week}</Text>
              {week.summary && <Text style={ss.weekSummary}>{week.summary}</Text>}
              {week.days?.map(d => (
                <View key={d.day} style={ss.dayRow}>
                  <Text style={ss.dayLabel}>{d.day}</Text>
                  <Text style={ss.dayWorkout}>{d.workout}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container:      { borderTopWidth: 0.5, borderTopColor: C.border, marginTop: 4 },
    header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    title:          { fontFamily: Fonts.medium, fontSize: 13, color: C.t1 },
    chevron:        { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    body:           { paddingHorizontal: 16, paddingBottom: 12 },
    inputRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
    input:          { flex: 1, backgroundColor: C.bg, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, fontFamily: Fonts.regular, fontSize: 13, color: C.t1 },
    genBtn:         { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
    genBtnDisabled: { opacity: 0.5 },
    genLabel:       { fontFamily: Fonts.semiBold, fontSize: 12, color: C.alwaysLight },
    week:           { marginBottom: 12 },
    weekTitle:      { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1, marginBottom: 4 },
    weekSummary:    { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, marginBottom: 6, lineHeight: 16 },
    dayRow:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
    dayLabel:       { fontFamily: Fonts.medium, fontSize: 11, color: C.t1, width: 30 },
    dayWorkout:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, flex: 1 },
  });
}
