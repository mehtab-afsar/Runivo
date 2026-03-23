import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { GoalOption } from './GoalOption';
import { ActivityLevelPicker } from './ActivityLevelPicker';

const GOALS = [
  { value: 'lose', label: 'Lose weight', emoji: '🔥' },
  { value: 'maintain', label: 'Maintain', emoji: '⚖️' },
  { value: 'gain', label: 'Gain muscle', emoji: '💪' },
] as const;

const DIETS = [
  { value: 'everything', label: 'Everything', emoji: '🍗' },
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥦' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
  { value: 'keto', label: 'Keto', emoji: '🥑' },
  { value: 'halal', label: 'Halal', emoji: '🌙' },
] as const;

interface Props {
  saving: boolean;
  goal: string; setGoal: (v: any) => void;
  activityLevel: any; setActivity: (v: any) => void;
  diet: string; setDiet: (v: any) => void;
  sex: 'male' | 'female'; setSex: (v: 'male' | 'female') => void;
  ageStr: string; weightStr: string; heightStr: string;
  updateField: (key: string, v: string) => void;
  dailyKcal: number; macros: { proteinG: number; carbsG: number; fatG: number };
  onSave: () => void;
}

export function NutritionSetupForm({ saving, goal, setGoal, activityLevel, setActivity, diet, setDiet, sex, setSex, ageStr, weightStr, heightStr, updateField, dailyKcal, macros, onSave }: Props) {
  return (
    <>
      <Text style={s.label}>Goal</Text>
      <View style={s.row}>
        {GOALS.map(g => <GoalOption key={g.value} goal={g.value} label={g.label} emoji={g.emoji} selected={goal === g.value} onSelect={v => setGoal(v as typeof goal)} />)}
      </View>

      <Text style={s.label}>Activity Level</Text>
      <ActivityLevelPicker selected={activityLevel} onSelect={setActivity} />

      <Text style={s.label}>Diet</Text>
      <View style={s.wrap}>
        {DIETS.map(d => (
          <Pressable key={d.value} style={[s.chip, diet === d.value && s.chipOn]} onPress={() => setDiet(d.value)}>
            <Text style={{ fontSize: 14 }}>{d.emoji}</Text>
            <Text style={[s.chipLabel, diet === d.value && s.chipLabelOn]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>About You</Text>
      <View style={s.row}>
        {(['male', 'female'] as const).map(v => (
          <Pressable key={v} style={[s.opt, sex === v && s.optOn, { flex: 1 }]} onPress={() => setSex(v)}>
            <Text style={{ fontSize: 18 }}>{v === 'male' ? '♂' : '♀'}</Text>
            <Text style={[s.optLabel, sex === v && s.optLabelOn]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.row}>
        {([['Age', 'ageStr', ageStr, 'numeric', 3], ['Weight (kg)', 'weightStr', weightStr, 'decimal-pad', 5], ['Height (cm)', 'heightStr', heightStr, 'decimal-pad', 5]] as const).map(([lbl, key, val, kb, max]) => (
          <View key={key} style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>{lbl}</Text>
            <TextInput style={s.numInput} value={val} onChangeText={v => updateField(key, v)} keyboardType={kb as any} maxLength={Number(max)} />
          </View>
        ))}
      </View>

      <View style={s.preview}>
        <Text style={s.previewTitle}>Daily targets</Text>
        <View style={s.previewRow}>
          {[{ val: String(dailyKcal), unit: 'kcal' }, { val: `${macros.proteinG}g`, unit: 'protein' }, { val: `${macros.carbsG}g`, unit: 'carbs' }, { val: `${macros.fatG}g`, unit: 'fat' }].map(({ val, unit }) => (
            <View key={unit} style={s.previewStat}>
              <Text style={s.previewVal}>{val}</Text>
              <Text style={s.previewUnit}>{unit}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable style={s.saveBtn} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveLabel}>Save & Start Tracking</Text>}
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 0.5, borderColor: '#DDD9D4' },
  chipOn: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  chipLabel: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: '#6B6B6B' },
  chipLabelOn: { color: '#fff', fontFamily: 'Barlow_500Medium' },
  opt: { paddingVertical: 14, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#DDD9D4', alignItems: 'center', gap: 4 },
  optOn: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  optLabel: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B' },
  optLabelOn: { color: '#fff', fontFamily: 'Barlow_500Medium' },
  fieldLabel: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD', marginBottom: 4 },
  numInput: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 10, paddingVertical: 10, fontFamily: 'Barlow_400Regular', fontSize: 16, color: '#0A0A0A', textAlign: 'center' },
  preview: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#DDD9D4', padding: 14, marginTop: 16 },
  previewTitle: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  previewRow: { flexDirection: 'row', gap: 8 },
  previewStat: { flex: 1, alignItems: 'center' },
  previewVal: { fontFamily: 'Barlow_700Bold', fontSize: 16, color: '#0A0A0A' },
  previewUnit: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD', marginTop: 1 },
  saveBtn: { backgroundColor: '#0A0A0A', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
