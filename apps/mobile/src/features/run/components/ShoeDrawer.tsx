import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import type { StoredShoe } from '@shared/services/store';
import { Colors } from '@theme';

const C = Colors;
const FONT      = 'Barlow_400Regular';
const FONT_SEMI = 'Barlow_600SemiBold';
const FONT_BOLD = 'Barlow_700Bold';

interface ShoeDrawerProps {
  shoes: StoredShoe[];
  selectedShoe: StoredShoe | null;
  bottomInset: number;
  onSelect: (shoe: StoredShoe) => void;
  onClose: () => void;
}

export default function ShoeDrawer({ shoes, selectedShoe, bottomInset, onSelect, onClose }: ShoeDrawerProps) {
  return (
    <Pressable style={ss.overlay} onPress={onClose}>
      <Pressable style={[ss.drawer, { paddingBottom: bottomInset + 16 }]} onPress={e => e.stopPropagation()}>
        <Text style={ss.title}>SELECT SHOE</Text>
        {shoes.map(shoe => (
          <Pressable key={shoe.id} style={ss.row} onPress={() => onSelect(shoe)}>
            <View style={[ss.dot, { backgroundColor: shoe.color ?? C.black }]} />
            <Text style={ss.name}>{shoe.nickname ?? `${shoe.brand} ${shoe.model}`}</Text>
            {shoe.id === selectedShoe?.id && <Check size={14} color={C.black} strokeWidth={2} />}
          </Pressable>
        ))}
      </Pressable>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 300 },
  drawer:  { backgroundColor: C.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  title:   { fontFamily: FONT_SEMI, fontSize: 12, color: C.t2, letterSpacing: 0.8, marginBottom: 12 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.mid },
  dot:     { width: 24, height: 24, borderRadius: 6 },
  name:    { flex: 1, fontFamily: FONT, fontSize: 13, color: C.black },
  check:   { fontFamily: FONT_BOLD, fontSize: 10, color: C.black },
});
