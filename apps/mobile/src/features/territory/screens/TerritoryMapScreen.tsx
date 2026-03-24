import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTerritoryMap } from '../hooks/useTerritoryMap';
import { TerritoryFilterChips } from '../components/TerritoryFilterChips';
import { TerritoryBottomSheet } from '../components/TerritoryBottomSheet';
import { TerritoryStatsBar } from '../components/TerritoryStatsBar';
import type { TerritoryDetails } from '../types';

let MapLibreGL: any = null;
try { MapLibreGL = require('@maplibre/maplibre-react-native'); } catch { /* not linked */ }

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TerritoryMapScreen() {
  const navigation = useNavigation<Nav>(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const map = useTerritoryMap();
  const fc = { all: map.ownedCount + map.enemyCount + map.freeCount, mine: map.ownedCount, enemy: map.enemyCount, weak: 0 };

  return (
    <View style={ss.root}>
      {MapLibreGL ? (
        <MapLibreGL.MapView style={ss.map} mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" logoEnabled={false} attributionEnabled={false} onPress={map.clearSelection}>
          <MapLibreGL.Camera ref={cameraRef} zoomLevel={14} centerCoordinate={map.userLocation ?? [77.209, 28.6139]} />
          <MapLibreGL.UserLocation visible renderMode="native" showsUserHeadingIndicator />
          {map.filteredGeoJSON?.features.length > 0 && (
            <MapLibreGL.ShapeSource id="territories" shape={map.filteredGeoJSON}
              onPress={(e: any) => { const p = e.features?.[0]?.properties; if (!p) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); map.selectTerritory({ id: p.id, ownerName: null, defense: p.defense, tier: p.tier ?? 'standard', isOwn: p.isOwned, h3Index: p.id } as TerritoryDetails); }}>
              <MapLibreGL.FillLayer id="territory-fill" style={{ fillColor: ['get', 'fillColor'], fillOpacity: 0.2 }} />
              <MapLibreGL.LineLayer id="territory-border" style={{ lineColor: ['get', 'fillColor'], lineWidth: 1.5, lineOpacity: 0.7 }} />
            </MapLibreGL.ShapeSource>
          )}
        </MapLibreGL.MapView>
      ) : (
        <View style={[ss.map, ss.fallback]}><ActivityIndicator color="#0A0A0A" /><Text style={ss.fallbackText}>Map unavailable in simulator</Text></View>
      )}

      <View style={[ss.header, { top: insets.top + 8 }]}>
        <Text style={ss.title}>Territory</Text>
        <TerritoryStatsBar ownedCount={map.ownedCount} enemyCount={map.enemyCount} freeCount={map.freeCount} />
      </View>

      <View style={[ss.filterRow, { top: insets.top + 62 }]}>
        <TerritoryFilterChips activeFilter={map.filter} counts={fc} onSelect={map.setFilter} />
      </View>

      <Pressable style={[ss.recenterBtn, { top: insets.top + 116 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (map.userLocation) cameraRef.current?.flyTo(map.userLocation, 200); }}>
        <Text style={{ fontSize: 14 }}>⊕</Text>
      </Pressable>

      {map.selectedTerritory && (
        <TerritoryBottomSheet territory={map.selectedTerritory} onClose={map.clearSelection}
          onFortify={async h3 => { await map.fortify(h3); navigation.navigate('ActiveRun' as any); map.clearSelection(); }} />
      )}

      {map.loading && <View style={ss.loader}><ActivityIndicator color="#E8391C" size="large" /></View>}
    </View>
  );
}

const ss = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F7F6F4' },
  map:         { flex: 1 }, fallback: { backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', gap: 8 }, fallbackText: { fontFamily: 'Barlow_400Regular', fontSize: 14, color: '#6B7280' },
  header:      { position: 'absolute', left: 12, right: 12, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: '#E0DFDD' },
  title: { flex: 1, fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A' },
  filterRow:   { position: 'absolute', left: 12, right: 12, zIndex: 20 },
  recenterBtn: { position: 'absolute', right: 12, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 0.5, borderColor: '#E0DFDD', alignItems: 'center', justifyContent: 'center' },
  loader:      { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: 'rgba(247,246,244,0.5)', alignItems: 'center', justifyContent: 'center' },
});
