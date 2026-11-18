import React, { useMemo } from 'react';
import { parseCoachReply } from '@shared/engine/coachSession';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
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
      <View style={s.labelRow}><PaceXOrb size={16} /><Text style={s.label}>AFTER YOUR LAST RUN</Text></View>
      <Text style={s.body} numberOfLines={3}>{parseCoachReply(message.content).text}</Text>
      <Pressable onPress={onReadMore} hitSlop={8}>
        <Text style={s.readMore}>Read more</Text>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:     { backgroundColor: C.surface, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, marginHorizontal: Spacing.gutter, marginBottom: 16 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    label:    { ...Type.overline, color: C.lavenderInk },
    body:     { fontFamily: Fonts.regular, fontSize: 14, color: C.black, lineHeight: 20 },
    readMore: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 8 },
  });
}
