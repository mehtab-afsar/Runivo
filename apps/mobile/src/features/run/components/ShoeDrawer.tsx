import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import type { StoredShoe } from '@shared/services/store';
import { useTheme, Fonts, type AppColors } from '@theme';

interface ShoeDrawerProps {
  shoes: StoredShoe[];
  selectedShoe: StoredShoe | null;
  bottomInset: number;
  onSelect: (shoe: StoredShoe) => void;
  onClose: () => void;
}

export default function ShoeDrawer({ shoes, selectedShoe, bottomInset, onSelect, onClose }: ShoeDrawerProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable style={ss.overlay} onPress={onClose}>
      <Pressable style={[ss.drawer, { paddingBottom: bottomInset + 16 }]} onPress={e => e.stopPropagation()}>
        <Text style={ss.title}>SELECT SHOE</Text>
        {shoes.map(shoe => (
          <Pressable key={shoe.id} style={ss.row} onPress={() => onSelect(shoe)}>
            <View style={[ss.dot, { backgroundColor: shoe.color ?? C.black }]} />
            <Text style={ss.name}>{shoe.nickname ?? `${shoe.brand} ${shoe.model}`}</Text>
            {shoe.id === selectedShoe?.id && <Check size={14} color={C.black} weight="regular" />}
          </Pressable>
        ))}
      </Pressable>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 300 },
    drawer:  { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, letterSpacing: 0.8, marginBottom: 12 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    dot:     { width: 24, height: 24, borderRadius: 6 },
    name:    { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.black },
    check:   { fontFamily: Fonts.bold, fontSize: 10, color: C.black },
  });
}
