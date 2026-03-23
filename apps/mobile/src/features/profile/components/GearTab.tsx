import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { StoredShoe } from '@shared/services/store';

const C = {
  black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', border: '#DDD9D4',
  stone: '#F0EDE8', red: '#D93518',
};

interface GearTabProps {
  shoes: StoredShoe[];
  onAddShoe: () => void;
}

export function GearTab({ shoes, onAddShoe }: GearTabProps) {
  return (
    <View>
      <View style={ss.gearHeader}>
        <Text style={ss.sectionTitle}>Shoes</Text>
        <Pressable onPress={onAddShoe}>
          <Text style={ss.gearAddBtn}>+ Add</Text>
        </Pressable>
      </View>

      {shoes.length === 0 ? (
        <View style={ss.emptyState}>
          <Text style={ss.emptyTitle}>No shoes yet</Text>
          <Text style={ss.emptyText}>Add your running shoes to track mileage.</Text>
          <Pressable style={ss.emptyBtn} onPress={onAddShoe}>
            <Text style={ss.emptyBtnLabel}>Add shoe</Text>
          </Pressable>
        </View>
      ) : (
        shoes.map(shoe => (
          <View key={shoe.id} style={ss.shoeCard}>
            <View style={ss.shoeEmoji}>
              <Text style={{ fontSize: 22 }}>👟</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.shoeName}>{shoe.nickname || shoe.model}</Text>
              <Text style={ss.shoeBrand}>{shoe.brand} · {shoe.model}</Text>
              <View style={ss.shoeMilesRow}>
                <Text style={ss.shoeMiles}>{shoe.maxKm} km max</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  sectionTitle: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black, letterSpacing: 0.5, textTransform: 'uppercase' },
  gearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  gearAddBtn: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.red },
  shoeCard: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  shoeEmoji: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
  shoeName: { fontFamily: 'Barlow_500Medium', fontSize: 14, color: C.black },
  shoeBrand: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  shoeMilesRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  shoeMiles: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.red },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
  emptyBtn: { marginTop: 16, backgroundColor: C.black, paddingVertical: 11, paddingHorizontal: 24, borderRadius: 4 },
  emptyBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
