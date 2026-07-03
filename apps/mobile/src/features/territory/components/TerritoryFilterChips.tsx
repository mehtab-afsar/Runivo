import React, { useMemo } from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TerritoryFilter } from '../types';
import { useTheme, type AppColors } from '@theme';

interface Props {
  activeFilter: TerritoryFilter;
  staleCount:   number;
  onSelect:     (filter: TerritoryFilter) => void;
}

const FILTERS: { id: TerritoryFilter; label: (n: number) => string }[] = [
  { id: 'all',    label: ()  => 'All'                          },
  { id: 'mine',   label: ()  => 'Mine'                         },
  { id: 'rivals', label: ()  => 'Rivals'                       },
  { id: 'stale',  label: n  => n > 0 ? `Stale ⚠ ${n}` : 'Stale' },
];

export function TerritoryFilterChips({ activeFilter, staleCount, onSelect }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ss.row}
      style={{ flex: 1 }}
    >
      {FILTERS.map(f => {
        const active = activeFilter === f.id;
        return (
          <Pressable
            key={f.id}
            style={[ss.pill, active && ss.pillActive]}
            onPress={() => { onSelect(f.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[ss.label, active && ss.labelActive]}>
              {f.label(staleCount)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { gap: 6, paddingRight: 8 },
    pill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.50)' },
    pillActive: { backgroundColor: C.red },
    label:      { fontSize: 13, color: C.white },
    labelActive:{ fontWeight: '500',  fontSize: 13, color: C.white },
  });
}
