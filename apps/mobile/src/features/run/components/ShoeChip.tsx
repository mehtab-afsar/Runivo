import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Footprints } from 'lucide-react-native';
import type { StoredShoe } from '@shared/services/store';
import { Colors } from '@theme';

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';

interface ShoeChipProps {
  shoe: StoredShoe | null;
  totalKm?: number;
  onPress: () => void;
}

export default function ShoeChip({ shoe, totalKm, onPress }: ShoeChipProps) {
  return (
    <Pressable style={ss.chip} onPress={onPress}>
      <View style={ss.iconWrap}><Footprints size={14} color={C.muted} strokeWidth={1.5} /></View>
      {shoe ? (
        <>
          <Text style={ss.name} numberOfLines={1}>
            {shoe.nickname ?? `${shoe.brand} ${shoe.model}`}
          </Text>
          {totalKm !== undefined && (
            <Text style={ss.km}>{totalKm.toFixed(0)} km</Text>
          )}
          <Text style={ss.change}>›</Text>
        </>
      ) : (
        <Text style={ss.add}>Add shoes →</Text>
      )}
    </Pressable>
  );
}

const ss = StyleSheet.create({
  chip:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, backgroundColor: C.white,
    borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
    marginHorizontal: 16,
  },
  iconWrap: { width: 20, alignItems: 'center' },
  name:   { flex: 1, fontFamily: FONT, fontSize: 12, color: C.black },
  km:     { fontFamily: FONT, fontSize: 11, color: C.muted },
  change: { fontFamily: FONT_MED, fontSize: 16, color: C.muted },
  add:    { fontFamily: FONT, fontSize: 12, color: C.red },
});
