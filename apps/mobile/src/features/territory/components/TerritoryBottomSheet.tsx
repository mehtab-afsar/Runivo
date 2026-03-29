import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TerritoryDetails } from '../types';

interface Props {
  territory: TerritoryDetails;
  onClose:   () => void;
  onFortify: (h3Index: string) => void;
}

function defenseColor(d: number) { return d > 70 ? '#1A7A4A' : d > 30 ? '#B87A00' : '#E8391C'; }
function statusLabel(isOwn: boolean, ownerName: string | null) { return isOwn ? 'YOURS' : ownerName ? 'ENEMY' : 'NEUTRAL'; }
function statusColor(isOwn: boolean, ownerName: string | null) { return isOwn ? '#E8391C' : ownerName ? '#DC2626' : '#ADADAD'; }
function statusBg(isOwn: boolean, ownerName: string | null)    { return isOwn ? '#FFF1EE' : ownerName ? '#FEF2F2' : '#EBEBEB'; }

export function TerritoryBottomSheet({ territory: t, onClose, onFortify }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[ss.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <View style={ss.handle} />

      <View style={ss.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[ss.badge, { backgroundColor: statusBg(t.isOwn, t.ownerName), alignSelf: 'flex-start' }]}>
            <Text style={[ss.badgeText, { color: statusColor(t.isOwn, t.ownerName) }]}>
              {statusLabel(t.isOwn, t.ownerName)}
            </Text>
          </View>
          {(t.h3Index ?? t.id) ? (
            <Text style={ss.hexId}>{t.h3Index ?? t.id}</Text>
          ) : null}
        </View>
        <Pressable onPress={onClose}>
          <Text style={{ color: '#7A7A7A', fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      <View style={ss.defenseRow}>
        <Text style={ss.defenseLabel}>Defense</Text>
        <View style={ss.track}>
          <View style={[ss.fill, { width: `${t.defense}%` as any, backgroundColor: defenseColor(t.defense) }]} />
        </View>
        <Text style={[ss.defenseVal, { color: defenseColor(t.defense) }]}>{t.defense}%</Text>
      </View>

      {t.tier && t.tier !== 'standard' && (
        <View style={ss.tierRow}>
          <Text style={ss.tierLabel}>Tier</Text>
          <Text style={ss.tierVal}>{t.tier}</Text>
        </View>
      )}

      {t.isOwn ? (
        <Pressable style={ss.fortifyBtn} onPress={() => onFortify(t.h3Index ?? t.id)}>
          <Text style={ss.fortifyLabel}>🛡️  Fortify — run to strengthen</Text>
        </Pressable>
      ) : t.ownerName ? (
        <Pressable style={[ss.fortifyBtn, { backgroundColor: '#DC2626' }]} onPress={() => onFortify(t.h3Index ?? t.id)}>
          <Text style={ss.fortifyLabel}>⚔️  Attack territory</Text>
        </Pressable>
      ) : (
        <Pressable style={[ss.fortifyBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0A0A0A' }]} onPress={() => onFortify(t.h3Index ?? t.id)}>
          <Text style={[ss.fortifyLabel, { color: '#0A0A0A' }]}>🚩  Claim this territory</Text>
        </Pressable>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 10 },
  handle:      { width: 36, height: 3, borderRadius: 9, backgroundColor: '#E0DFDD', alignSelf: 'center', marginBottom: 16 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  hexId:       { fontFamily: 'Courier', fontSize: 10, color: '#ADADAD', letterSpacing: 0.5 },
  badge:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText:   { fontFamily: 'Barlow_600SemiBold', fontSize: 11, letterSpacing: 1 },
  defenseRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  defenseLabel:{ fontFamily: 'Barlow_400Regular', fontSize: 12, color: '#7A7A7A', width: 60 },
  track:       { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F0EDE8', overflow: 'hidden' },
  fill:        { height: '100%', borderRadius: 3 },
  defenseVal:  { fontFamily: 'Barlow_600SemiBold', fontSize: 12, width: 36, textAlign: 'right' },
  tierRow:     { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  tierLabel:   { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#ADADAD' },
  tierVal:     { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#0A0A0A', textTransform: 'capitalize' },
  fortifyBtn:  { backgroundColor: '#0A0A0A', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  fortifyLabel:{ fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff', letterSpacing: 1 },
});
