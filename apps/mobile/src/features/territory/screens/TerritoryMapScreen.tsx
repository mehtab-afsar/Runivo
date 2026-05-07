import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getSettings } from '@shared/services/store';
import { Locate, Layers } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, type AppColors } from '@theme';
import { useTerritoryMap } from '../hooks/useTerritoryMap';
import { TerritoryFilterChips } from '../components/TerritoryFilterChips';
import { TerritoryBottomSheet } from '../components/TerritoryBottomSheet';
import { TerritoryStatsBar } from '../components/TerritoryStatsBar';
import type { TerritoryDetails } from '../types';

// MapLibre GL requires a style JSON URL for vector tile styles.
// For raster tile sources (Terrain, Satellite), we wrap the XYZ tile
// URL inside an inline GL style object so MapLibre can consume it.

const TERRAIN_STYLE = JSON.stringify({
  version: 8,
  sources: {
    'raster-tiles': {
      type: 'raster',
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenTopoMap contributors',
    },
  },
  layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 17 }],
});

const SATELLITE_STYLE = JSON.stringify({
  version: 8,
  sources: {
    'raster-tiles': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 19 }],
});

const MAP_STYLES = [
  { id: 'standard',  label: 'Standard',  color: '#E8F5E9', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark',      label: 'Dark',      color: '#263238', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light',     label: 'Light',     color: '#FAFAFA', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'terrain',   label: 'Terrain',   color: '#C8E6C9', url: TERRAIN_STYLE },
  { id: 'satellite', label: 'Satellite', color: '#1B5E20', url: SATELLITE_STYLE },
] as const;

let MapLibreGL: any = null;
try { MapLibreGL = require('@maplibre/maplibre-react-native'); } catch { /* not linked */ }

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TerritoryMapScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const map = useTerritoryMap();
  const fc = { all: map.ownedCount + map.enemyCount + map.freeCount, mine: map.ownedCount, enemy: map.enemyCount, weak: 0, neutral: map.freeCount };
  const [activeStyleId, setActiveStyleId] = useState<string>('standard');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const activeStyle = MAP_STYLES.find(st => st.id === activeStyleId) ?? MAP_STYLES[0];

  useEffect(() => {
    getSettings().then(st => {
      if (st.mapStyle) {
        const id = st.mapStyle.toLowerCase();
        if (MAP_STYLES.find(m => m.id === id)) setActiveStyleId(id);
      }
    });
  }, []);

  const handleRecenter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (map.userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: map.userLocation,
        zoomLevel: 14,
        animationDuration: 400,
        animationMode: 'flyTo',
      });
    }
  };

  return (
    <View style={s.root}>
      {MapLibreGL ? (
        <MapLibreGL.MapView style={s.map} mapStyle={activeStyle.url} logoEnabled={false} attributionEnabled={false} onPress={map.clearSelection}>
          <MapLibreGL.Camera
            ref={cameraRef}
            zoomLevel={14}
            centerCoordinate={map.userLocation ?? undefined}
            followUserLocation={!map.userLocation}
            followZoomLevel={14}
          />
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
        <View style={[s.map, s.fallback]}><ActivityIndicator color={C.black} /><Text style={s.fallbackText}>Map unavailable in simulator</Text></View>
      )}

      <View style={[s.header, { top: insets.top + 8 }]}>
        <Text style={s.title}>Territory</Text>
        <TerritoryStatsBar ownedCount={map.ownedCount} enemyCount={map.enemyCount} freeCount={map.freeCount} />
      </View>

      <View style={[s.filterRow, { top: insets.top + 62 }]}>
        <TerritoryFilterChips activeFilter={map.filter} counts={fc} onSelect={map.setFilter} />
      </View>

      {/* Recenter button — uses Locate icon so it's visually distinct from the style picker */}
      <Pressable style={[s.floatBtn, { top: insets.top + 116 }]} onPress={handleRecenter}>
        <Locate size={15} color={C.black} strokeWidth={1.5} />
      </Pressable>

      {/* Map style picker button — uses Layers icon */}
      <Pressable style={[s.floatBtn, { top: insets.top + 164 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStylePicker(v => !v); }}>
        <Layers size={15} color={showStylePicker ? C.red : C.black} strokeWidth={1.5} />
      </Pressable>

      {showStylePicker && (
        <View style={[s.stylePicker, { top: insets.top + 164 }]}>
          <Text style={s.stylePickerTitle}>MAP STYLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {MAP_STYLES.map(style => (
              <Pressable
                key={style.id}
                style={[s.styleSwatch, activeStyleId === style.id && s.styleSwatchActive]}
                onPress={() => { setActiveStyleId(style.id); setShowStylePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <View style={[s.swatchColor, { backgroundColor: style.color }]} />
                <Text style={[s.swatchLabel, activeStyleId === style.id && s.swatchLabelActive]}>{style.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {map.selectedTerritory && (
        <TerritoryBottomSheet territory={map.selectedTerritory} onClose={map.clearSelection}
          onFortify={async h3 => { await map.fortify(h3); navigation.navigate('ActiveRun' as any); map.clearSelection(); }} />
      )}

      {map.loading && <View style={s.loader}><ActivityIndicator color={C.red} size="large" /></View>}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:             { flex: 1, backgroundColor: C.bg },
    map:              { flex: 1 },
    fallback:         { backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', gap: 8 },
    fallbackText:     { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.t2 },
    header:           { position: 'absolute', left: 12, right: 12, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: C.border },
    title:            { flex: 1, fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    filterRow:        { position: 'absolute', left: 12, right: 12, zIndex: 20 },
    floatBtn:         { position: 'absolute', right: 12, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    loader:           { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: C.bg + '80', alignItems: 'center', justifyContent: 'center' },
    stylePicker:      { position: 'absolute', right: 56, zIndex: 30, backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, padding: 12, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8, maxWidth: 260 },
    stylePickerTitle: { fontFamily: 'Barlow_500Medium', fontSize: 9, letterSpacing: 1, color: C.t3, marginBottom: 10 },
    styleSwatch:      { alignItems: 'center', gap: 5, borderRadius: 10, padding: 6, borderWidth: 1.5, borderColor: 'transparent' },
    styleSwatchActive:{ borderColor: C.black },
    swatchColor:      { width: 44, height: 32, borderRadius: 8 },
    swatchLabel:      { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t2, textAlign: 'center' },
    swatchLabelActive:{ fontFamily: 'Barlow_600SemiBold', color: C.black },
  });
}
