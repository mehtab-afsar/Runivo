import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@theme';
import { Spacing } from '@theme';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
  style?: ViewStyle;
}

export function FilterChip({ label, active, onPress, count, style }: FilterChipProps) {
  const C = useTheme();

  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  const bg     = active ? C.accent  : C.surface;
  const border = active ? C.accent  : C.border;
  const color  = active ? C.alwaysLight : C.black;
  const countBg    = active ? 'rgba(255,255,255,0.25)' : C.accentMuted;
  const countColor = active ? C.alwaysLight : C.accent;

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, { backgroundColor: bg, borderColor: border }, style]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
      {count !== undefined && (
        <View style={[styles.countBadge, { backgroundColor: countBg }]}>
          <Text style={[styles.countText, { color: countColor }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip:       {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: Spacing.height.chip, borderRadius: Spacing.radius.full,
    borderWidth: 0.5, paddingHorizontal: 12,
  },
  label:      { fontWeight: '500', fontSize: 13 },
  countBadge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  countText:  { fontWeight: '600', fontSize: 10 },
});
