import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface GoalOptionProps {
  goal: string;
  label: string;
  description?: string;
  emoji?: string;
  iconNode?: React.ReactNode;
  selected: boolean;
  onSelect: (goal: string) => void;
}

export function GoalOption({ goal, label, emoji, iconNode, selected, onSelect }: GoalOptionProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable
      style={[s.btn, selected && s.btnActive]}
      onPress={() => onSelect(goal)}
    >
      {iconNode ?? (emoji ? <Text style={{ fontSize: 18 }}>{emoji}</Text> : null)}
      <Text style={[s.label, selected && s.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border,
    alignItems: 'center', gap: 4,
  },
  btnActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
  label: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },
  labelActive: { color: C.alwaysLight, fontFamily: Fonts.medium },
}); }
