import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Footprints } from 'lucide-react-native';
import type { StoredShoe } from '@shared/services/store';
import { ShoeProgressBar } from '@features/gear/components/ShoeProgressBar';

const CATEGORY_LABELS: Record<StoredShoe['category'], string> = {
  road: 'Road', trail: 'Trail', track: 'Track', casual: 'Casual',
};

function barColor(pct: number): string {
  if (pct >= 0.85) return '#D93518';
  if (pct >= 0.60) return '#9E6800';
  return '#1A6B40';
}

interface ShoeCardProps {
  shoe: StoredShoe;
  kmRun: number;
  onSetDefault: () => void;
  onRetire: () => void;
  onDelete: () => void;
}

export function ShoeCard({ shoe, kmRun, onSetDefault, onRetire, onDelete }: ShoeCardProps) {
  const pct = Math.min(1, kmRun / shoe.maxKm);
  const remaining = Math.max(0, shoe.maxKm - kmRun);
  const color = barColor(pct);

  return (
    <View style={[s.card, shoe.isRetired && s.retired]}>
      <View style={s.top}>
        <View style={s.icon}><Footprints size={20} color="#6B6B6B" strokeWidth={1.5} /></View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.name}>{shoe.nickname || `${shoe.brand} ${shoe.model}`}</Text>
            {shoe.isDefault && (
              <View style={s.defaultBadge}><Text style={s.defaultLabel}>Default</Text></View>
            )}
          </View>
          <Text style={s.model}>{shoe.brand} {shoe.model}</Text>
          <View style={s.categoryRow}>
            <Text style={s.category}>{CATEGORY_LABELS[shoe.category]}</Text>
            {pct >= 1 && !shoe.isRetired && (
              <View style={[s.statusBadge, s.badgeRed]}><Text style={[s.statusLabel, { color: '#D93518' }]}>REPLACE</Text></View>
            )}
            {pct >= 0.85 && pct < 1 && !shoe.isRetired && (
              <View style={[s.statusBadge, s.badgeAmber]}><Text style={[s.statusLabel, { color: '#9E6800' }]}>WORN</Text></View>
            )}
          </View>
        </View>
      </View>

      <View style={s.mileageRow}>
        <Text style={s.mileage}>{kmRun.toFixed(0)} / {shoe.maxKm} km</Text>
        <Text style={s.remaining}>{remaining.toFixed(0)} km left</Text>
      </View>
      <ShoeProgressBar pct={pct} color={color} />

      {shoe.isRetired && (
        <View style={s.retiredBadge}><Text style={s.retiredLabel}>Retired</Text></View>
      )}

      <View style={s.actions}>
        {!shoe.isDefault && !shoe.isRetired && (
          <Pressable style={s.actionBtn} onPress={onSetDefault}>
            <Text style={s.actionLabel}>Set default</Text>
          </Pressable>
        )}
        {!shoe.isRetired && (
          <Pressable style={s.actionBtn} onPress={onRetire}>
            <Text style={s.actionLabel}>Retire</Text>
          </Pressable>
        )}
        <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={onDelete}>
          <Text style={s.deleteLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 0.5, borderColor: '#DDD9D4', padding: 14 },
  retired: { opacity: 0.6 },
  top: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0EDE8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  name: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#0A0A0A' },
  defaultBadge: { backgroundColor: '#EDF7F2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  defaultLabel: { fontFamily: 'Barlow_400Regular', fontSize: 9, color: '#1A6B40', textTransform: 'uppercase', letterSpacing: 0.5 },
  model: { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#6B6B6B', marginBottom: 1 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  category: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD' },
  statusBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeRed: { backgroundColor: '#FEF0EE' },
  badgeAmber: { backgroundColor: '#FDF6E8' },
  statusLabel: { fontFamily: 'Barlow_500Medium', fontSize: 8, letterSpacing: 0.5 },
  mileageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mileage: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B' },
  remaining: { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#ADADAD' },
  retiredBadge: { backgroundColor: '#F0EDE8', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 8, marginBottom: 4 },
  retiredLabel: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F0EDE8', borderWidth: 0.5, borderColor: '#DDD9D4' },
  deleteBtn: { backgroundColor: '#FEF0EE', borderColor: '#D9351844' },
  actionLabel: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B' },
  deleteLabel: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#D93518' },
});
