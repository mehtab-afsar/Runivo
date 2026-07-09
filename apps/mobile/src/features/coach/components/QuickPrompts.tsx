import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Fonts, useTheme, type AppColors } from '@theme';

interface Props {
  prompts:  string[];
  onSelect: (prompt: string) => void;
}

export function QuickPrompts({ prompts, onSelect }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.container}>
      {prompts.map(p => (
        <Pressable key={p} style={ss.btn} onPress={() => onSelect(p)}>
          <Text style={ss.label}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container: { paddingHorizontal: 16, gap: 8 },
    btn:       { backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12 },
    label:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t1 },
  });
}
