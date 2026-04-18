import React, { useState, useEffect } from 'react';
import {
  Modal, SafeAreaView, View, Text, TextInput, Pressable,
  ScrollView, StyleSheet, Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import type { NutritionEntry } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import { MEALS } from '@features/nutrition/types';

interface AddFoodModalProps {
  visible: boolean;
  defaultMeal: Meal;
  onAdd: (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => void;
  onClose: () => void;
}

export function AddFoodModal({ visible, defaultMeal, onAdd, onClose }: AddFoodModalProps) {
  const [name, setName]       = useState('');
  const [kcal, setKcal]       = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs]     = useState('');
  const [fat, setFat]         = useState('');
  const [meal, setMeal]       = useState<Meal>(defaultMeal);

  useEffect(() => { setMeal(defaultMeal); }, [defaultMeal]);

  const canAdd = name.trim().length > 0 && parseFloat(kcal) > 0;

  const handleAdd = () => {
    if (!canAdd) return;
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
    setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <X size={16} color="#6B6B6B" strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Add Food</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
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

          <Text style={s.fieldLabel}>Food name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Chicken breast" placeholderTextColor="#ADADAD" />

          <Text style={s.fieldLabel}>Calories *</Text>
          <TextInput style={s.input} value={kcal} onChangeText={setKcal} placeholder="300" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />

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
  closeBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  closeText: { fontFamily: 'Barlow_400Regular', fontSize: 16, color: '#6B6B6B' },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: '#0A0A0A' },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
  mealRow: { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 8 },
  mealBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF',
    borderWidth: 0.5, borderColor: '#DDD9D4', alignItems: 'center', gap: 2,
  },
  mealBtnActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  mealLabel: { fontFamily: 'Barlow_300Light', fontSize: 9, color: '#6B6B6B' },
  mealLabelActive: { color: '#fff', fontFamily: 'Barlow_400Regular' },
  fieldLabel: {
    fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD',
    textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 10, marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4',
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Barlow_400Regular', fontSize: 14, color: '#0A0A0A',
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: {
    backgroundColor: '#0A0A0A', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
