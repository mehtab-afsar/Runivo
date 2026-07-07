import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import type { CoachMessage } from '../services/coachService';

interface Props {
  message: CoachMessage;
  onReadMore: () => void;
}

export function PaceAutoCard({ message, onReadMore }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={s.card}>
      <Text style={s.label}>✨ AFTER YOUR LAST RUN</Text>
      <Text style={s.body} numberOfLines={3}>{message.content}</Text>
      <Pressable onPress={onReadMore} hitSlop={8}>
        <Text style={s.readMore}>Read more →</Text>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:     { backgroundColor: C.surface, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, marginHorizontal: Spacing.gutter, marginBottom: 16 },
    label:    { ...Type.overline, color: C.purple, marginBottom: 8 },
    body:     { fontFamily: Fonts.regular, fontSize: 14, color: C.black, lineHeight: 20 },
    readMore: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 8 },
  });
}
