import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import type { LoopRowData } from '../../utils/activeRunTypes';

/** "Close the loop to claim" progress under the live stats. */
export default function LoopProgressRow({ loopRow }: { loopRow: LoopRowData }) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const zone = territoryPalette(useIsDark());
  return (
    <View style={ss.loopRow}>
      <View style={ss.loopHead}>
        <Text style={ss.loopLabel}>{loopRow.label}</Text>
        <Text style={ss.loopDetail}><Text style={{ color: zone.own, fontFamily: Fonts.bold }}>{loopRow.detail.split(' · ')[0]}</Text>{loopRow.detail.includes(' · ') ? ` · ${loopRow.detail.split(' · ').slice(1).join(' · ')}` : ''}</Text>
      </View>
      <View style={ss.loopTrack}>
        <View style={[ss.loopFill, { width: `${Math.round(Math.min(1, Math.max(0, loopRow.pct)) * 100)}%`, backgroundColor: zone.own }]} />
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    loopRow:     { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 18, backgroundColor: C.mint },
    loopHead:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    loopLabel:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    loopDetail:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, fontVariant: ['tabular-nums'] },
    loopTrack:   { height: 8, borderRadius: 4, backgroundColor: C.mint2, overflow: 'hidden', marginTop: 8 },
    loopFill:    { height: 8, borderRadius: 9 },
  });
}
