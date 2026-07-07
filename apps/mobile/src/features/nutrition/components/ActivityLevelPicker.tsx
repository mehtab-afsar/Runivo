import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Television as Tv, Pulse, Trophy, Check, type Icon } from 'phosphor-react-native';
import { Colors, Fonts } from '@theme';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const OPTIONS: { value: ActivityLevel; label: string; Icon: Icon; iconColor: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',         Icon: Tv,     iconColor: '#ADADAD' },
  { value: 'light',       label: 'Lightly active',    Icon: Pulse,  iconColor: '#6B6B6B' },
  { value: 'moderate',    label: 'Moderately active', Icon: Pulse,  iconColor: '#1A6B40' },
  { value: 'active',      label: 'Very active',       Icon: Pulse,  iconColor: '#D93518' },
  { value: 'very_active', label: 'Athlete',           Icon: Trophy, iconColor: '#D97706' },
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
            <opt.Icon size={18} color={selected === opt.value ? Colors.alwaysLight : opt.iconColor} weight="light" />
          </View>
          <Text style={[s.label, selected === opt.value && s.labelActive]}>{opt.label}</Text>
          {selected === opt.value && <Check size={14} color="#1A6B40" weight="regular" />}
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
    backgroundColor: Colors.white, borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4',
  },
  rowActive: { backgroundColor: Colors.alwaysDark, borderColor: Colors.alwaysDark },
  label: { fontFamily: Fonts.regular, fontSize: 13, color: '#0A0A0A', flex: 1 },
  labelActive: { color: Colors.alwaysLight },
  check: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#1A6B40' },
});
