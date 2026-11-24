import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface Props {
  stolen: number;
  newZones: number;
  fortified: boolean;
  paceEarned: number;
  paceDisplay: number;
}

/** Territory tiles, as on the mock's activity page: taken back · new zones · PACE. */
export default function RunTerritoryTiles({ stolen, newZones, fortified, paceEarned, paceDisplay }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      <Text style={ss.h2}>Territory</Text>
      <View style={ss.terrRow}>
        <View style={[ss.terrTile, { backgroundColor: C.mint }]}>
          <Text style={ss.terrVal}>{stolen}</Text>
          <Text style={[ss.terrLbl, { color: '#4E5A44' }]}>Taken back</Text>
        </View>
        <View style={[ss.terrTile, { backgroundColor: C.mint }]}>
          <Text style={ss.terrVal}>{newZones}</Text>
          <Text style={[ss.terrLbl, { color: '#4E5A44' }]}>{fortified ? 'Refreshed' : 'New zones'}</Text>
        </View>
        <View style={[ss.terrTile, { backgroundColor: C.amberBg }]}>
          <Text style={ss.terrVal}>{paceEarned > 0 ? `+${paceDisplay}` : '0'}</Text>
          <Text style={[ss.terrLbl, { color: '#7A5525' }]}>PACE</Text>
        </View>
      </View>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    h2:       { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, marginHorizontal: Spacing.gutter, marginTop: 18 },
    terrRow:  { flexDirection: 'row', gap: 8, marginHorizontal: Spacing.gutter, marginTop: 12, marginBottom: 16 },
    terrTile: { flex: 1, borderRadius: 18, padding: 12, gap: 2 },
    terrVal:  { fontFamily: Fonts.semiBold, fontSize: 20, color: C.t1, fontVariant: ['tabular-nums'] },
    terrLbl:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
  });
}
