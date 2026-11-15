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
    { id: 'all',    label: 'All' },
    { id: 'mine',   label: `Mine ${counts.mine}`,     dot: z.own },
    { id: 'rivals', label: `Rivals ${counts.rivals}`, dot: z.rival },
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
          <View style={[ss.dot, { backgroundColor: z.own, opacity: 0.5 }]} />
          <Text style={[ss.label, heatmapOn && ss.labelActive]}>Heatmap</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { gap: 8, paddingRight: 8 },
    pill:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    pillActive: { backgroundColor: C.t1, borderColor: C.t1 },
    dot:        { width: 8, height: 8, borderRadius: 2 },
    label:      { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    labelActive:{ color: C.card },
  });
}
