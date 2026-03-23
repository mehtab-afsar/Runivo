import React from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import type { NutritionEntry } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import { MEALS } from '@features/nutrition/types';

interface MealSectionProps {
  meal: Meal;
  entries: NutritionEntry[];
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

export function MealSection({ meal, entries, expanded, onToggle, onDelete, onAdd }: MealSectionProps) {
  const meta = MEALS.find(m => m.value === meal)!;
  const mealKcal = entries.reduce((s, e) => s + e.kcal, 0);

  const confirmDelete = (id: number) => {
    Alert.alert('Delete entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
    ]);
  };

  return (
    <View style={s.section}>
      <Pressable style={s.header} onPress={onToggle}>
        <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
        <Text style={s.title}>{meta.label}</Text>
        {mealKcal > 0 && <Text style={s.kcal}>{mealKcal} kcal</Text>}
        <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <>
          {entries.map(e => (
            <Pressable
              key={e.id}
              style={s.entry}
              onLongPress={() => e.id !== undefined && confirmDelete(e.id as number)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.entryName}>{e.name}</Text>
                <Text style={s.entryMacros}>{e.proteinG}g P · {e.carbsG}g C · {e.fatG}g F</Text>
              </View>
              <Text style={s.entryKcal}>{e.kcal} kcal</Text>
            </Pressable>
          ))}
          <Pressable style={s.addBtn} onPress={onAdd}>
            <Text style={s.addLabel}>+ Add {meta.label.toLowerCase()}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 0.5,
    borderColor: '#DDD9D4', overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  title: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A', flex: 1 },
  kcal: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B' },
  chevron: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD' },
  entry: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: '#DDD9D4',
  },
  entryName: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: '#0A0A0A', marginBottom: 1 },
  entryMacros: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD' },
  entryKcal: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A' },
  addBtn: {
    borderTopWidth: 0.5, borderTopColor: '#DDD9D4',
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center',
  },
  addLabel: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: '#D93518' },
});
