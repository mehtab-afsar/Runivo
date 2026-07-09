import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, type KeyboardTypeOptions } from 'react-native';
import { Fire, Scales as Scale, Barbell, ForkKnife as UtensilsCrossed, Leaf, Fish, Moon } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { GoalOption } from './GoalOption';
import { ActivityLevelPicker } from './ActivityLevelPicker';

function mkGoals(C: AppColors) {
  return [
    { value: 'lose',     label: 'Lose weight', iconNode: <Fire    size={18} color={C.orange} weight="light" /> },
    { value: 'maintain', label: 'Maintain',    iconNode: <Scale   size={18} color={C.t2}     weight="light" /> },
    { value: 'gain',     label: 'Gain muscle', iconNode: <Barbell size={18} color={C.purple} weight="light" /> },
  ] as const;
}

function mkDiets(C: AppColors) {
  return [
    { value: 'everything',  label: 'Everything',  iconNode: <UtensilsCrossed size={14} color={C.t2}     weight="light" /> },
    { value: 'vegetarian',  label: 'Vegetarian',  iconNode: <Leaf  size={14} color={C.green}  weight="light" /> },
    { value: 'vegan',       label: 'Vegan',       iconNode: <Leaf  size={14} color={C.green}  weight="light" /> },
    { value: 'pescatarian', label: 'Pescatarian', iconNode: <Fish  size={14} color={C.blue}   weight="light" /> },
    { value: 'keto',        label: 'Keto',        iconNode: <Fire  size={14} color={C.orange} weight="light" /> },
    { value: 'halal',       label: 'Halal',       iconNode: <Moon  size={14} color={C.purple} weight="light" /> },
  ] as const;
}

type GoalValue = ReturnType<typeof mkGoals>[number]['value'];
type DietValue = ReturnType<typeof mkDiets>[number]['value'];

interface Props {
  saving: boolean;
  goal: GoalValue; setGoal: (v: GoalValue) => void;
  activityLevel: string; setActivity: (v: string) => void;
  diet: DietValue; setDiet: (v: DietValue) => void;
  sex: 'male' | 'female'; setSex: (v: 'male' | 'female') => void;
  ageStr: string; weightStr: string; heightStr: string;
  updateField: (key: string, v: string) => void;
  dailyKcal: number; macros: { proteinG: number; carbsG: number; fatG: number };
  onSave: () => void;
}

export function NutritionSetupForm({ saving, goal, setGoal, activityLevel, setActivity, diet, setDiet, sex, setSex, ageStr, weightStr, heightStr, updateField, dailyKcal, macros, onSave }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const GOALS = useMemo(() => mkGoals(C), [C]);
  const DIETS = useMemo(() => mkDiets(C), [C]);
  return (
    <>
      <Text style={s.label}>Goal</Text>
      <View style={s.row}>
        {GOALS.map(g => <GoalOption key={g.value} goal={g.value} label={g.label} iconNode={g.iconNode} selected={goal === g.value} onSelect={v => setGoal(v as typeof goal)} />)}
      </View>

      <Text style={s.label}>Activity Level</Text>
      <ActivityLevelPicker selected={activityLevel} onSelect={setActivity} />

      <Text style={s.label}>Diet</Text>
      <View style={s.wrap}>
        {DIETS.map(d => (
          <Pressable key={d.value} style={[s.chip, diet === d.value && s.chipOn]} onPress={() => setDiet(d.value)}>
            {d.iconNode}
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
            <TextInput style={s.numInput} value={val} onChangeText={v => updateField(key, v)} keyboardType={kb as KeyboardTypeOptions} maxLength={Number(max)} />
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
        {saving ? <ActivityIndicator size="small" color={C.alwaysLight} /> : <Text style={s.saveLabel}>Save & Start Tracking</Text>}
      </Pressable>
    </>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  label: { ...Type.overline, color: C.t3, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.card, borderRadius: 20, borderWidth: 0.5, borderColor: C.border },
  chipOn: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
  chipLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
  chipLabelOn: { color: C.alwaysLight, fontFamily: Fonts.medium },
  opt: { paddingVertical: 14, borderRadius: 10, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', gap: 4 },
  optOn: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
  optLabel: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },
  optLabelOn: { color: C.alwaysLight, fontFamily: Fonts.medium },
  fieldLabel: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginBottom: 4 },
  numInput: { backgroundColor: C.card, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 16, color: C.t1, textAlign: 'center' },
  preview: { backgroundColor: C.card, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, marginTop: 16 },
  previewTitle: { ...Type.overline, color: C.t3, marginBottom: 12 },
  previewRow: { flexDirection: 'row', gap: 8 },
  previewStat: { flex: 1, alignItems: 'center' },
  previewVal: { fontFamily: Fonts.bold, fontSize: 16, color: C.t1, fontVariant: ['tabular-nums'] },
  previewUnit: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginTop: 1 },
  saveBtn: { backgroundColor: C.alwaysDark, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight, letterSpacing: 1 },
}); }
