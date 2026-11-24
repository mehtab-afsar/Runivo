import React, { useMemo } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { Play } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  verb: string;
  onPress: () => void;
}

/** The big "Start run" button shown before the run begins. */
export default function ActiveRunStartButton({ verb, onPress }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable style={({ pressed }) => [ss.startBtn, pressed && { opacity: 0.9 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Start ${verb}`}>
      <Play size={20} color={C.lime} weight="fill" />
      <Text style={ss.startTxt}>Start {verb}</Text>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    startBtn:    { height: 60, borderRadius: 30, backgroundColor: C.alwaysDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    startTxt:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.alwaysLight },
  });
}
