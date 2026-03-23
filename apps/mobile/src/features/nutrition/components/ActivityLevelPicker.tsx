import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const OPTIONS: { value: ActivityLevel; label: string; emoji: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',         emoji: '🛋️' },
  { value: 'light',       label: 'Lightly active',    emoji: '🚶' },
  { value: 'moderate',    label: 'Moderately active', emoji: '🏃' },
  { value: 'active',      label: 'Very active',       emoji: '⚡' },
  { value: 'very_active', label: 'Athlete',           emoji: '🏆' },
];

interface ActivityLevelPickerProps {
  selected: ActivityLevel;
  onSelect: (level: ActivityLevel) => void;
}

export function ActivityLevelPicker({ selected, onSelect }: ActivityLevelPickerProps) {
  return (
    <View style={s.col}>
      {OPTIONS.map(opt => (
        <Pressable
          key={opt.value}
          style={[s.row, selected === opt.value && s.rowActive]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={{ fontSize: 18, width: 28 }}>{opt.emoji}</Text>
          <Text style={[s.label, selected === opt.value && s.labelActive]}>{opt.label}</Text>
          {selected === opt.value && <Text style={s.check}>✓</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  col: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4',
  },
  rowActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  label: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#0A0A0A', flex: 1 },
  labelActive: { color: '#fff' },
  check: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#1A6B40' },
});
