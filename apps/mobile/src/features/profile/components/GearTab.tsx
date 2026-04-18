import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Footprints } from 'lucide-react-native';
import type { StoredRun, StoredShoe } from '@shared/services/store';
import { Colors } from '@theme';

const C = Colors;

interface GearTabProps {
  shoes: StoredShoe[];
  runs?: StoredRun[];
  onAddShoe: () => void;
}

export function GearTab({ shoes, runs = [], onAddShoe }: GearTabProps) {
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
        shoes.map(shoe => {
          const usedKm = runs
            .filter(r => r.shoeId === shoe.id)
            .reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
          const maxKm = shoe.maxKm ?? 800;
          const pct = Math.min(usedKm / maxKm, 1);
          const barColor = pct >= 0.85 ? '#D93518' : pct >= 0.6 ? '#9E6800' : '#1A6B40';
          const statusLabel = shoe.isRetired ? 'Retired' : pct >= 0.85 ? 'Replace soon' : pct >= 0.6 ? 'Moderate wear' : 'Good';
          const statusColor = shoe.isRetired ? C.t3 : pct >= 0.85 ? '#D93518' : pct >= 0.6 ? '#9E6800' : '#1A6B40';

          return (
            <View key={shoe.id} style={[ss.shoeCard, shoe.isRetired && ss.shoeRetired]}>
              <View style={ss.shoeEmoji}>
                <Footprints size={22} color="#6B6B6B" strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={ss.shoeNameRow}>
                  <Text style={ss.shoeName}>{shoe.nickname || shoe.model}</Text>
                  <Text style={[ss.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <Text style={ss.shoeBrand}>{shoe.brand} · {shoe.model}</Text>

                {/* Mileage bar */}
                <View style={ss.barTrack}>
                  <View style={[ss.barFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: barColor }]} />
                </View>
                <View style={ss.barLabels}>
                  <Text style={ss.barLabel}>{Math.round(usedKm)} km used</Text>
                  <Text style={ss.barLabel}>{Math.round(maxKm - usedKm)} km left</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  sectionTitle:  { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black, letterSpacing: 0.5, textTransform: 'uppercase' },
  gearHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  gearAddBtn:    { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.red },
  shoeCard:      { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  shoeRetired:   { opacity: 0.55 },
  shoeEmoji:     { width: 40, height: 40, borderRadius: 10, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  shoeNameRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  shoeName:      { fontFamily: 'Barlow_500Medium', fontSize: 14, color: C.black },
  shoeBrand:     { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, marginBottom: 8 },
  statusBadge:   { fontFamily: 'Barlow_500Medium', fontSize: 10 },
  barTrack:      { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  barFill:       { height: '100%', borderRadius: 3 },
  barLabels:     { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel:      { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3 },
  emptyState:    { alignItems: 'center', paddingVertical: 32 },
  emptyTitle:    { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText:     { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
  emptyBtn:      { marginTop: 16, backgroundColor: C.black, paddingVertical: 11, paddingHorizontal: 24, borderRadius: 4 },
  emptyBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
