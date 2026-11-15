import React, { useMemo } from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import type { TerritoryFilter } from '../types';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';

interface Props {
  activeFilter: TerritoryFilter;
  counts:       { mine: number; rivals: number; stale: number };
  onSelect:     (filter: TerritoryFilter) => void;
  /** M3: everywhere you've run, drawn under the zones. */
  heatmapOn?:   boolean;
  onHeatmap?:   () => void;
}

/** "All · Mine 9 · Rivals 48 · Fading 2", each with the map's colour dot. */
export function TerritoryFilterChips({ activeFilter, counts, onSelect, heatmapOn, onHeatmap }: Props) {
  const C = useTheme();
  const z = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);
  const filters: { id: TerritoryFilter; label: string; dot?: string }[] = [
    { id: 'all',    label: 'Zones' },
    { id: 'mine',   label: `Mine ${counts.mine}` },
    { id: 'rivals', label: `Rivals ${counts.rivals}` },
    { id: 'stale',  label: `Fading ${counts.stale}` },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.row}>
      {filters.map(f => {
        const active = activeFilter === f.id;
        return (
          <Pressable hitSlop={8}
            key={f.id}
            style={[ss.pill, active && ss.pillActive]}
            onPress={() => { onSelect(f.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {!!f.dot && <View style={[ss.dot, { backgroundColor: f.dot }]} />}
            <Text style={[ss.label, active && ss.labelActive]}>{f.label}</Text>
          </Pressable>
        );
      })}
      {onHeatmap && (
        <Pressable hitSlop={8}
          style={[ss.pill, heatmapOn && ss.pillActive]}
          onPress={() => { onHeatmap(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!heatmapOn }}
        >
          <Text style={[ss.label, heatmapOn && ss.labelActive]}>Heatmap</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { gap: 8, paddingRight: 8 },
    pill:       {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: C.card,
      borderWidth: 2, borderColor: 'transparent',
      shadowColor: '#17181A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    pillActive: { borderColor: C.t1 },
    dot:        { width: 9, height: 9, borderRadius: 3 },
    label:      { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    labelActive:{ fontFamily: Fonts.semiBold },
  });
}
