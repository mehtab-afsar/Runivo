import React from 'react';
import { View, Text } from 'react-native';
import { useTheme, Fonts } from '@theme';
import type { StoredShoe } from '@shared/services/store';
import ShoeChip from '../ShoeChip';

interface Props {
  allShoes: StoredShoe[];
  runShoe: StoredShoe | null;
  shoeTotalKm: number;
  onPress: () => void;
}

/** P5: which shoes, and a nudge when they're near the end of their life. */
export default function RunShoeSection({ allShoes, runShoe, shoeTotalKm, onPress }: Props) {
  const C = useTheme();
  if (allShoes.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <ShoeChip shoe={runShoe} totalKm={runShoe ? shoeTotalKm : undefined} onPress={onPress} />
      {runShoe && shoeTotalKm >= runShoe.maxKm * 0.9 && (
        <Text style={{ fontFamily: Fonts.medium, fontSize: 12.5, color: C.red, paddingHorizontal: 4 }}>
          {shoeTotalKm >= runShoe.maxKm
            ? `These are past ${runShoe.maxKm} km. Time to retire them.`
            : `${Math.max(0, Math.round(runShoe.maxKm - shoeTotalKm))} km left before these hit ${runShoe.maxKm} km.`}
        </Text>
      )}
    </View>
  );
}
