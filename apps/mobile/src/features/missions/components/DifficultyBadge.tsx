import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const diffColors: Record<Difficulty, { bg: string; fg: string }> = {
    easy:   { bg: C.greenBg, fg: C.green },
    medium: { bg: C.amberBg, fg: C.amber },
    hard:   { bg: C.redLo, fg: C.red },
  };
  const colors = diffColors[difficulty] ?? diffColors.medium;
  return (
    <View style={[ss.badge, { backgroundColor: colors.bg }]}>
      <Text style={[ss.text, { color: colors.fg }]}>{difficulty}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    text: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  });
}
