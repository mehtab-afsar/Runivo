import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
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
              placeholderTextColor="#ADADAD"
            />
            <Pressable style={[ss.genBtn, loading && ss.genBtnDisabled]} onPress={onGenerate} disabled={loading}>
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
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

const ss = StyleSheet.create({
  container:      { borderTopWidth: 0.5, borderTopColor: '#DDD9D4', marginTop: 4 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title:          { fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A' },
  chevron:        { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#ADADAD' },
  body:           { paddingHorizontal: 16, paddingBottom: 12 },
  inputRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:          { flex: 1, backgroundColor: '#F8F6F3', borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 12, paddingVertical: 8, fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#0A0A0A' },
  genBtn:         { backgroundColor: '#D93518', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  genBtnDisabled: { opacity: 0.5 },
  genLabel:       { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: '#fff' },
  week:           { marginBottom: 12 },
  weekTitle:      { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: '#0A0A0A', marginBottom: 4 },
  weekSummary:    { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#6B6B6B', marginBottom: 6, lineHeight: 16 },
  dayRow:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dayLabel:       { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#0A0A0A', width: 30 },
  dayWorkout:     { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B', flex: 1 },
});
