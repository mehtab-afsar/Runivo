import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, SafeAreaView, View, Text, TextInput, Pressable,
  ScrollView, StyleSheet, Platform,
} from 'react-native';
import { X } from 'phosphor-react-native';
import type { NutritionEntry } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import { MEALS } from '@features/nutrition/types';

const QUICK_ADDS = [
  { name: 'Banana',         kcal: 90,  protein: 1,  carbs: 23, fat: 0 },
  { name: 'Protein shake',  kcal: 150, protein: 25, carbs: 6,  fat: 3 },
  { name: 'Black coffee',   kcal: 5,   protein: 0,  carbs: 1,  fat: 0 },
  { name: 'Protein bar',    kcal: 200, protein: 20, carbs: 22, fat: 5 },
  { name: 'Greek yogurt',   kcal: 100, protein: 17, carbs: 6,  fat: 0 },
  { name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0,  fat: 4 },
];

interface AddFoodModalProps {
  visible: boolean;
  defaultMeal: Meal;
  defaultKcal?: number;
  onAdd: (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => void;
  onClose: () => void;
}

export function AddFoodModal({ visible, defaultMeal, defaultKcal, onAdd, onClose }: AddFoodModalProps) {
  const [name, setName]       = useState('');
  const [kcal, setKcal]       = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs]     = useState('');
  const [fat, setFat]         = useState('');
  const [meal, setMeal]       = useState<Meal>(defaultMeal);

  useEffect(() => { setMeal(defaultMeal); }, [defaultMeal]);

  useEffect(() => {
    if (defaultKcal && defaultKcal > 0) {
      setKcal(String(defaultKcal));
    }
  }, [defaultKcal]);

  const canAdd = name.trim().length > 0 && parseFloat(kcal) > 0;
  const submittingRef = useRef(false);

  const applyQuickAdd = (q: typeof QUICK_ADDS[0]) => {
    setName(q.name);
    setKcal(String(q.kcal));
    setProtein(String(q.protein));
    setCarbs(String(q.carbs));
    setFat(String(q.fat));
  };

  const reset = () => {
    setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat('');
  };

  const handleAdd = () => {
    if (!canAdd || submittingRef.current) return;
    submittingRef.current = true;
    onAdd({
      meal, name: name.trim(),
      kcal: parseFloat(kcal) || 0,
      proteinG: parseFloat(protein) || 0,
      carbsG: parseFloat(carbs) || 0,
      fatG: parseFloat(fat) || 0,
      servingSize: '1 serving',
      source: 'manual',
      synced: false,
    });
    reset();
    submittingRef.current = false;
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.closeBtn}>
            <X size={16} color="#6B6B6B" weight="regular" />
          </Pressable>
          <Text style={s.title}>Log Food</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Meal selector */}
          <View style={s.mealRow}>
            {MEALS.map(m => (
              <Pressable
                key={m.value}
                style={[s.mealBtn, meal === m.value && s.mealBtnActive]}
                onPress={() => setMeal(m.value)}
              >
                <Text style={{ fontSize: 14 }}>{m.emoji}</Text>
                <Text style={[s.mealLabel, meal === m.value && s.mealLabelActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Quick-add chips */}
          <Text style={s.sectionLabel}>QUICK ADD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsContent}>
            {QUICK_ADDS.map(q => (
              <Pressable key={q.name} style={s.chip} onPress={() => applyQuickAdd(q)}>
                <Text style={s.chipName}>{q.name}</Text>
                <Text style={s.chipKcal}>{q.kcal} kcal</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Food name */}
          <Text style={s.fieldLabel}>Food name *</Text>
          <TextInput
            style={s.input} value={name} onChangeText={setName}
            placeholder="e.g. Chicken breast" placeholderTextColor="#ADADAD"
          />

          {/* Calories */}
          <Text style={s.fieldLabel}>Calories *</Text>
          <TextInput
            style={s.input} value={kcal} onChangeText={setKcal}
            placeholder="300" placeholderTextColor="#ADADAD"
            keyboardType="decimal-pad"
          />

          {/* Macros row */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Protein (g)</Text>
              <TextInput style={s.input} value={protein} onChangeText={setProtein} placeholder="25" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Carbs (g)</Text>
              <TextInput style={s.input} value={carbs} onChangeText={setCarbs} placeholder="30" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Fat (g)</Text>
              <TextInput style={s.input} value={fat} onChangeText={setFat} placeholder="10" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />
            </View>
          </View>

          <Pressable style={[s.addBtn, !canAdd && s.addBtnDisabled]} onPress={handleAdd} disabled={!canAdd}>
            <Text style={s.addBtnLabel}>Add Food</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEAE5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#DDD9D4',
  },
  closeBtn:    { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: '#0A0A0A' },
  content:     { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
  sectionLabel:{ fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  mealRow:     { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 4 },
  mealBtn:     { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#DDD9D4', alignItems: 'center', gap: 2 },
  mealBtnActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  mealLabel:   { fontSize: 9, color: '#6B6B6B' },
  mealLabelActive: { color: '#fff' },
  chips:       { flexGrow: 0 },
  chipsContent:{ flexDirection: 'row', gap: 6 },
  chip:        { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 2 },
  chipName:    { fontWeight: '500', fontSize: 11, color: '#0A0A0A' },
  chipKcal:    { fontSize: 9, color: '#ADADAD' },
  fieldLabel:  { fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 10, marginBottom: 4 },
  input:       { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0A0A0A' },
  row:         { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn:      { backgroundColor: '#0A0A0A', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnLabel: { fontWeight: '600', fontSize: 14, color: '#fff', letterSpacing: 1 },
});
