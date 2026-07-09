import React, { useMemo } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import type { NutritionEntry } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import { MEALS } from '@features/nutrition/types';
import { useTheme, Fonts, type AppColors } from '@theme';

interface MealSectionProps {
  meal: Meal;
  entries: NutritionEntry[];
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

export function MealSection({ meal, entries, expanded, onToggle, onDelete, onAdd }: MealSectionProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
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

function mkStyles(C: AppColors) { return StyleSheet.create({
  section: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5,
    borderColor: C.border, overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  title: { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, flex: 1 },
  kcal: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 10, color: C.t3 },
  entry: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: C.border,
  },
  entryName: { fontFamily: Fonts.regular, fontSize: 12, color: C.t1, marginBottom: 1 },
  entryMacros: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3 },
  entryKcal: { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, fontVariant: ['tabular-nums'] },
  addBtn: {
    borderTopWidth: 0.5, borderTopColor: C.border,
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center',
  },
  addLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.red },
}); }
