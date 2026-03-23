import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { CalorieRing } from './CalorieRing';
import { MacroBars } from './MacroBars';
import { MealSection } from './MealSection';
import { MEALS } from '../types';
import type { NutritionProfile, NutritionEntry } from '@shared/services/store';
import type { Meal } from '../types';

interface Props {
  profile: NutritionProfile;
  entries: NutritionEntry[];
  consumed: number; pct: number;
  proteinConsumed: number; carbsConsumed: number; fatConsumed: number;
  expandedMeal: Meal | null;
  setExpandedMeal: (m: Meal | null) => void;
  deleteEntry: (id: number) => void;
  openAdd: (m: Meal) => void;
  onLogFood: () => void;
}

export function TrackerBody({ profile, entries, consumed, pct, proteinConsumed, carbsConsumed, fatConsumed, expandedMeal, setExpandedMeal, deleteEntry, openAdd, onLogFood }: Props) {
  return (
    <>
      <View style={s.card}>
        <CalorieRing consumed={consumed} goal={profile.dailyGoalKcal} pct={pct} />
      </View>
      <View style={s.card}>
        <MacroBars
          proteinConsumed={proteinConsumed} proteinGoal={profile.proteinGoalG}
          carbsConsumed={carbsConsumed} carbsGoal={profile.carbsGoalG}
          fatConsumed={fatConsumed} fatGoal={profile.fatGoalG}
        />
      </View>
      {MEALS.map(m => (
        <MealSection
          key={m.value} meal={m.value}
          entries={entries.filter(e => e.meal === m.value && e.source !== 'run')}
          expanded={expandedMeal === m.value}
          onToggle={() => setExpandedMeal(expandedMeal === m.value ? null : m.value)}
          onDelete={deleteEntry} onAdd={() => openAdd(m.value)}
        />
      ))}
      <Pressable style={s.logBtn} onPress={onLogFood}>
        <Text style={s.logBtnLabel}>+ Log Food</Text>
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 0.5, borderColor: '#DDD9D4', padding: 14 },
  logBtn: { backgroundColor: '#0A0A0A', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  logBtnLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
