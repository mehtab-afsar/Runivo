import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Television as Tv, Pulse, Trophy, Check, type Icon } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

function mkOptions(C: AppColors): { value: ActivityLevel; label: string; Icon: Icon; iconColor: string }[] {
  return [
    { value: 'sedentary',   label: 'Sedentary',         Icon: Tv,     iconColor: C.t3 },
    { value: 'light',       label: 'Lightly active',    Icon: Pulse,  iconColor: C.t2 },
    { value: 'moderate',    label: 'Moderately active', Icon: Pulse,  iconColor: C.green },
    { value: 'active',      label: 'Very active',       Icon: Pulse,  iconColor: C.red },
    { value: 'very_active', label: 'Athlete',           Icon: Trophy, iconColor: C.amber },
  ];
}

interface ActivityLevelPickerProps {
  selected: string;
  onSelect: (level: string) => void;
}

export function ActivityLevelPicker({ selected, onSelect }: ActivityLevelPickerProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const OPTIONS = useMemo(() => mkOptions(C), [C]);
  return (
    <View style={s.col}>
      {OPTIONS.map(opt => (
        <Pressable
          key={opt.value}
          style={[s.row, selected === opt.value && s.rowActive]}
          onPress={() => onSelect(opt.value)}
        >
          <View style={{ width: 28, alignItems: 'center' }}>
            <opt.Icon size={18} color={selected === opt.value ? C.alwaysLight : opt.iconColor} weight="light" />
          </View>
          <Text style={[s.label, selected === opt.value && s.labelActive]}>{opt.label}</Text>
          {selected === opt.value && <Check size={14} color={C.green} weight="regular" />}
        </Pressable>
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  col: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
  },
  rowActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
  label: { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, flex: 1 },
  labelActive: { color: C.alwaysLight },
  check: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.green },
}); }
