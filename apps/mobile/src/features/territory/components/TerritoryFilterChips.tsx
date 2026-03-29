import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TerritoryFilter } from '../types';

interface Props {
  activeFilter: TerritoryFilter;
  counts:       { all: number; mine: number; enemy: number; weak: number; neutral?: number };
  onSelect:     (filter: TerritoryFilter) => void;
}

const FILTERS: { id: TerritoryFilter; label: string }[] = [
  { id: 'all',     label: 'All'   },
  { id: 'mine',    label: 'Mine'  },
  { id: 'enemy',   label: 'Enemy' },
  { id: 'weak',    label: 'Weak'  },
  { id: 'neutral', label: 'Free'  },
];

export function TerritoryFilterChips({ activeFilter, counts, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {FILTERS.map(f => {
        const active = activeFilter === f.id;
        const count  = counts[f.id];
        return (
          <Pressable
            key={f.id}
            style={[ss.pill, active && ss.pillActive]}
            onPress={() => { onSelect(f.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[ss.label, active && ss.labelActive]}>
              {f.label}{(count ?? 0) > 0 ? ` ${count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  pill:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 0.5, borderColor: '#E0DFDD' },
  pillActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  label:      { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#7A7A7A' },
  labelActive:{ fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#fff' },
});
