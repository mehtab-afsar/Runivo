import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Play } from 'phosphor-react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  hasRunToday: boolean;
  onPress: () => void;
}

export function RunCTACard({ hasRunToday, onPress }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  return (
    <Pressable style={ss.card} onPress={onPress}>
      <View style={ss.left}>
        <Text style={ss.label}>{hasRunToday ? 'KEEP THE STREAK' : 'START YOUR DAY'}</Text>
        <Text style={ss.title}>{hasRunToday ? 'Run again.' : 'Ready to run?'}</Text>
        <Text style={ss.sub}>{hasRunToday ? 'Defend your territory.' : 'Claim new ground today.'}</Text>
      </View>
      <View style={ss.iconWrap}>
        <Play size={22} color="#fff" weight="fill" />
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 22, marginBottom: 28, backgroundColor: C.alwaysDark, borderRadius: 20, padding: 22 },
    left:     { flex: 1 },
    label:    { fontWeight: '500', fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', marginBottom: 6 },
    title:    { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 24, color: '#fff', fontStyle: 'italic' },
    sub:      { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  });
}
