import React, { useRef, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MapPin, Layers } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, type AppColors } from '@theme';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTerritoryMap } from '../hooks/useTerritoryMap';
import { TerritoryFilterChips } from '../components/TerritoryFilterChips';
import { TerritoryBottomSheet } from '../components/TerritoryBottomSheet';
import { TerritoryStatsBar } from '../components/TerritoryStatsBar';

// Raster tile sources need to be wrapped in an inline GL style JSON
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

let ML: any = null;
try { ML = require('@maplibre/maplibre-react-native'); } catch {}

const ACCENT = '#D93518';

const territoryFillStyle = {
  fillColor: ['case',
    ['all', ['==', ['get', 'isOwn'], true], ['>=', ['get', 'freshness'], 70]], ACCENT,
    ['all', ['==', ['get', 'isOwn'], true], ['>=', ['get', 'freshness'], 40]], '#D4785A',
    ['all', ['==', ['get', 'isOwn'], true], ['<',  ['get', 'freshness'], 40]], '#EF9F27',
    '#6B7FA3',
  ],
  fillOpacity: ['case', ['==', ['get', 'isOwn'], true], 0.40, 0.25],
} as any;

const territoryLineStyle = {
  lineColor:   ['case', ['==', ['get', 'isOwn'], true], ACCENT, '#8899BB'],
  lineWidth:   ['case', ['==', ['get', 'isOwn'], true], 2.0, 1.0],
  lineOpacity: 0.8,
} as any;

const selectedFillStyle = { fillColor: ACCENT, fillOpacity: 0.55 };

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TerritoryMapScreen() {
  const C      = useTheme();
  const ss     = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route  = useRoute<RouteProp<RootStackParamList, 'TerritoryMap'>>();
  const initialFilter = route.params?.initialFilter;

  const {
    ownPolygons, rivalPolygons, geoJSON, activeFilter, setActiveFilter,
    selectedPolygon, setSelectedPolygon, stats, isLoadingRivals,
    defaultCenter, handleBboxChange,
  } = useTerritoryMap(initialFilter);

  const cameraRef = useRef<any>(null);
  const [styleIdx, setStyleIdx] = useState(0);

  const cycleMapStyle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStyleIdx(prev => (prev + 1) % MAP_STYLES.length);
  };

  const selectedFilter = selectedPolygon
    ? ['==', ['get', 'id'], selectedPolygon.id]
    : ['==', ['get', 'id'], ''];

  function handleRegionChange(feature: any) {
    const bounds = feature?.properties?.visibleBounds;
    if (!bounds) return;
    handleBboxChange({
      minLng: bounds[0][0], minLat: bounds[0][1],
      maxLng: bounds[1][0], maxLat: bounds[1][1],
    });
  }

  function handlePolygonPress(e: any) {
    const feat = e.features?.[0];
    if (!feat) { setSelectedPolygon(null); return; }
    const p = feat.properties as any;
    setSelectedPolygon({
      id: p.id, ownerId: p.ownerId, ownerName: p.ownerName,
      isOwn: p.isOwn, freshness: p.freshness, tier: p.tier,
      areaM2: p.areaM2, claimedAt: p.claimedAt, isLoopFill: p.isLoopFill,
    });
  }

  const isEmpty = ownPolygons.length === 0 && rivalPolygons.length === 0 && !isLoadingRivals;

  return (
    <View style={ss.container}>
      {ML ? (
        <ML.MapView
          style={ss.map}
          styleURL={MAP_STYLES[styleIdx].url}
          onRegionDidChange={handleRegionChange}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <ML.Camera
            ref={cameraRef}
            centerCoordinate={defaultCenter}
            zoomLevel={13}
            animationDuration={0}
          />
          <ML.UserLocation visible={true} />
          {geoJSON.features.length > 0 && (
            <ML.ShapeSource id="territories" shape={geoJSON} onPress={handlePolygonPress}>
              <ML.FillLayer id="territory-fill" style={territoryFillStyle} />
              <ML.LineLayer id="territory-line" style={territoryLineStyle} />
              <ML.FillLayer id="territory-selected" style={selectedFillStyle} filter={selectedFilter} />
            </ML.ShapeSource>
          )}
        </ML.MapView>
      ) : (
        <View style={ss.map} />
      )}

      <View style={[ss.topOverlay, { top: insets.top + 12 }]}>
        <TerritoryFilterChips
          activeFilter={activeFilter}
          staleCount={stats.staleCount}
          onSelect={setActiveFilter}
        />
        <Pressable style={ss.styleBtn} onPress={cycleMapStyle}>
          <Layers size={18} color="#fff" strokeWidth={1.5} />
        </Pressable>
      </View>

      {isEmpty && (
        <View style={ss.emptyState}>
          <MapPin size={48} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <Text style={ss.emptyTitle}>No territories yet</Text>
          <Text style={ss.emptyBody}>Start a run to claim your first zone</Text>
          <Pressable style={ss.emptyBtn}
            onPress={() => navigation.navigate('Main', { screen: 'Run' })}>
            <Text style={ss.emptyBtnText}>Start a run →</Text>
          </Pressable>
        </View>
      )}

      {selectedPolygon ? (
        <TerritoryBottomSheet
          polygon={selectedPolygon}
          onClose={() => setSelectedPolygon(null)}
          onDefend={() => { setSelectedPolygon(null); navigation.navigate('Main', { screen: 'Run' }); }}
        />
      ) : (
        <TerritoryStatsBar
          stats={stats}
          isLoadingRivals={isLoadingRivals}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mkStyles(_C: AppColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: '#000' },
    map:          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    topOverlay:   { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    styleBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    emptyState:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', gap: 12, padding: 40 },
    emptyTitle:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: '#fff', fontStyle: 'italic' },
    emptyBody:    { fontFamily: 'Barlow_300Light', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    emptyBtn:     { backgroundColor: '#D93518', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
    emptyBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff' },
  });
}
