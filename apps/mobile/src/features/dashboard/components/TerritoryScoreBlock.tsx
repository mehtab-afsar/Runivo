import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  score: number;
  cityRank: number | null;
}

export function TerritoryScoreBlock({ score, cityRank }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={ss.wrap}>
      <Text style={ss.score}>{score.toLocaleString()}</Text>
      <Text style={ss.label}>TERRITORY SCORE</Text>
      {cityRank !== null && (
        <Text style={ss.rank}>#{cityRank} in your city</Text>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:  { alignItems: 'flex-end' },
    score: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 26, color: C.black, fontStyle: 'italic' },
    label: { fontFamily: 'Barlow_500Medium', fontSize: 9, letterSpacing: 1.2, color: C.t3, marginTop: 2 },
    rank:  { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.red, marginTop: 1 },
  });
}
