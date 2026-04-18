import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tv, Activity, Trophy, Check, type LucideIcon } from 'lucide-react-native';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const OPTIONS: { value: ActivityLevel; label: string; Icon: LucideIcon; iconColor: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',         Icon: Tv,       iconColor: '#ADADAD' },
  { value: 'light',       label: 'Lightly active',    Icon: Activity, iconColor: '#6B6B6B' },
  { value: 'moderate',    label: 'Moderately active', Icon: Activity, iconColor: '#1A6B40' },
  { value: 'active',      label: 'Very active',       Icon: Activity, iconColor: '#D93518' },
  { value: 'very_active', label: 'Athlete',           Icon: Trophy,   iconColor: '#D97706' },
];

interface ActivityLevelPickerProps {
  selected: string;
  onSelect: (level: string) => void;
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
          <View style={{ width: 28, alignItems: 'center' }}>
            <opt.Icon size={18} color={selected === opt.value ? '#fff' : opt.iconColor} strokeWidth={1.5} />
          </View>
          <Text style={[s.label, selected === opt.value && s.labelActive]}>{opt.label}</Text>
          {selected === opt.value && <Check size={14} color="#1A6B40" strokeWidth={2} />}
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
