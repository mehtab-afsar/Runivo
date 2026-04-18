import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import type { StoredSavedRoute } from '@shared/services/store';
import type { NearbyRoute } from '@shared/services/sync';
import RouteCard from './RouteCard';
import type { RouteItem } from './RouteCard';
import { Colors } from '@theme';

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

interface RouteModalProps {
  visible: boolean;
  savedRoutes: StoredSavedRoute[];
  nearbyRoutes: NearbyRoute[];
  nearbyLoading: boolean;
  gpsReady: boolean;
  selectedRouteName: string | null;
  bottomInset: number;
  onSelectRoute: (name: string, gpsPoints: { lat: number; lng: number }[]) => void;
  onClearRoute: () => void;
  onFindNearby: () => void;
  onClose: () => void;
}

export default function RouteModal({
  visible, savedRoutes, nearbyRoutes, nearbyLoading, gpsReady,
  selectedRouteName, bottomInset, onSelectRoute, onClearRoute, onFindNearby, onClose,
}: RouteModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose} />
      <View style={[ss.sheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <View style={ss.header}>
          <View>
            <Text style={ss.title}>Routes</Text>
            <Text style={ss.sub}>Choose a route to follow</Text>
          </View>
          <Pressable style={ss.closeBtn} onPress={onClose}>
            <X size={14} color={C.muted} strokeWidth={2} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={ss.list} showsVerticalScrollIndicator={false}>
          {selectedRouteName && (
            <Pressable style={[ss.clearRow]} onPress={() => { onClearRoute(); onClose(); }}>
              <View style={[ss.routeIcon, { backgroundColor: C.red }]}>
                <X size={14} color="#fff" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONT, fontSize: 12, color: C.red }}>Clear: {selectedRouteName}</Text>
                <Text style={{ fontFamily: FONT_LIGHT, fontSize: 11, color: C.red, opacity: 0.7 }}>Tap to remove route</Text>
              </View>
            </Pressable>
          )}

          <Text style={ss.section}>My Routes</Text>
          {savedRoutes.length === 0 ? (
            <Text style={ss.empty}>No saved routes yet. Finish a run to save one.</Text>
          ) : savedRoutes.map(r => (
            <RouteCard
              key={r.id}
              route={{ id: r.id, name: r.name, emoji: r.emoji, distanceM: r.distanceM, durationSec: r.durationSec ?? undefined }}
              onSelect={() => { onSelectRoute(`${r.emoji} ${r.name}`, r.gpsPoints); onClose(); }}
            />
          ))}

          <View style={ss.nearbyHeader}>
            <Text style={ss.section}>Nearby</Text>
            <Pressable onPress={onFindNearby} disabled={nearbyLoading || !gpsReady}>
              <Text style={{ fontFamily: FONT, fontSize: 12, color: nearbyLoading || !gpsReady ? C.t3 : C.black }}>
                {nearbyLoading ? 'Searching...' : 'Find Routes'}
              </Text>
            </Pressable>
          </View>
          {nearbyRoutes.length === 0 ? (
            <Text style={ss.empty}>{nearbyLoading ? 'Searching nearby...' : 'Tap "Find Routes" to discover routes near you.'}</Text>
          ) : nearbyRoutes.map(r => (
            <RouteCard
              key={r.id}
              route={{ id: r.id, name: r.name, emoji: r.emoji, distanceM: r.distanceM, distanceAwayM: r.distM, username: r.username }}
              onSelect={() => { onSelectRoute(`${r.emoji} ${r.name}`, r.gpsPoints); onClose(); }}
              highlighted
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet:       { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 4 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title:       { fontFamily: FONT_MED, fontSize: 17, color: C.black },
  sub:         { fontFamily: FONT_LIGHT, fontSize: 12, color: C.muted, marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  list:        { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  clearRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FDE8E4', borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 10 },
  routeIcon:   { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  section:     { fontFamily: FONT_LIGHT, fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  empty:       { fontFamily: FONT_LIGHT, fontSize: 12, color: C.muted, paddingTop: 4, paddingBottom: 8 },
  nearbyHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
});
