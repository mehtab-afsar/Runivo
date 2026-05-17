import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TerritoryFilter } from '../types';

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

const ss = StyleSheet.create({
  row:        { gap: 6, paddingRight: 8 },
  pill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.50)' },
  pillActive: { backgroundColor: '#D93518' },
  label:      { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#fff' },
  labelActive:{ fontFamily: 'Barlow_500Medium',  fontSize: 13, color: '#fff' },
});
