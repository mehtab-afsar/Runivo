import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Colors } from '@theme';

const C = Colors;
const FONT      = 'Barlow_400Regular';
const FONT_SEMI = 'Barlow_600SemiBold';

const TIER_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  bronze: { bg: '#FEF3C7', color: '#B45309', label: 'Bronze' },
  silver: { bg: '#F3F4F6', color: '#4B5563', label: 'Silver' },
  gold:   { bg: '#FEF9C3', color: '#854D0E', label: 'Gold' },
};

interface TerritoryChip {
  tier: 'bronze' | 'silver' | 'gold';
  count: number;
}

interface TerritoryChipsProps {
  territories: TerritoryChip[];
}

export default function TerritoryChips({ territories }: TerritoryChipsProps) {
  if (territories.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.row}>
      {territories.map(({ tier, count }) => {
        const style = TIER_STYLES[tier] ?? TIER_STYLES.bronze;
        return (
          <View key={tier} style={[ss.chip, { backgroundColor: style.bg, borderColor: style.color + '40' }]}>
            <Text style={[ss.count, { color: style.color }]}>{count}</Text>
            <Text style={[ss.label, { color: style.color }]}>{style.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, alignItems: 'center', gap: 2 },
  count: { fontFamily: FONT_SEMI, fontSize: 16 },
  label: { fontFamily: FONT, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
});
