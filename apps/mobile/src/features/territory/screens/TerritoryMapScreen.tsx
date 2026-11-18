import { safeRing, safeLine, safeCenter } from '@mobile/shared/map/geo';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, BookmarkSimple, Fire, Crosshair, ArrowsClockwise, Stack, CaretLeft } from 'phosphor-react-native';
import { HeaderButton } from '@mobile/shared/components/ScreenHeader';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette, territoryLayerStyles } from '@theme/territory';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTerritoryMap } from '../hooks/useTerritoryMap';
import { TerritoryFilterChips } from '../components/TerritoryFilterChips';
import { TerritoryBottomSheet } from '../components/TerritoryBottomSheet';
import { MapSearchBar } from '../components/MapSearchBar';
import PlanLoopSheet from '../components/PlanLoopSheet';
import { fetchClubTerritory } from '@features/clubs/services/clubService';
import type { LoopPlan } from '@shared/engine/planLoop';
import { getRuns } from '@shared/services/store';

import { MAP_STYLES } from '@theme/maps';
import ML from '@maplibre/maplibre-react-native';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';
import { useHideTabBar } from '@navigation/tabBarVisibility';
import { ZoneCard } from '../components/ZoneCard';
import { useLiveFriendRuns } from '@features/run/hooks/useLiveFriendRuns';
import { LiveFriendMarker } from '@features/run/components/LiveFriendMarker';
import { CheerSheet, type CheerTarget } from '@features/cheers/CheerSheet';
import { ENGINE } from '@shared/engine/runEngine';
import { PositionArrow } from '@mobile/shared/components/PositionArrow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMPTY_ZONES: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function TerritoryMapScreen() {
  const C      = useTheme();
  const ss     = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route  = useRoute<RouteProp<RootStackParamList, 'TerritoryMap'>>();
  const stacked = route.name === 'TerritoryMap';
  const initialFilter = route.params?.initialFilter;
  const clubId = route.params?.clubId;
  const clubName = route.params?.clubName;
  // Club ground (C2): every member's zones, drawn over the map.
  const [clubShape, setClubShape] = useState<any>(null);
  useEffect(() => {
    if (!clubId) return;
    fetchClubTerritory(clubId).then(zs => {
      setClubShape({ type: 'FeatureCollection', features: zs.flatMap(z => { const ring = safeRing(z.ring); return ring ? [{ type: 'Feature', properties: { id: z.id }, geometry: { type: 'Polygon', coordinates: [ring] } }] : []; }) });
      const pts = zs.flatMap(z => z.ring);
      if (pts.length) {
        const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
        cameraRef.current?.fitBounds([Math.max(...lngs), Math.max(...lats)], [Math.min(...lngs), Math.min(...lats)], [120, 40, 160, 40], 700);
      }
    }).catch(() => {});
  }, [clubId]);

  const {
    ownPolygons, rivalPolygons, geoJSON, activeFilter, setActiveFilter,
    selectedPolygon, setSelectedPolygon, stats, isLoadingRivals, ownLoaded,
    defaultCenter, handleBboxChange, locationStatus, requestLocation,
  } = useTerritoryMap(initialFilter);
  const [locationCardDismissed, setLocationCardDismissed] = useState(false);
  // M3: personal heatmap. Overlapping lines build up, so streets you run a lot glow.
  const zonePal = territoryPalette(useIsDark());
  const [heatmapOn, setHeatmapOn] = useState(false);
  // Mock's layers button: choose what the map draws.
  const [layersOpen, setLayersOpen] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showFriends, setShowFriends] = useState(true);
  const recentre = async () => {
    const pos = await Location.getLastKnownPositionAsync().catch(() => null)
      ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (pos) cameraRef.current?.setCamera({ centerCoordinate: [pos.coords.longitude, pos.coords.latitude], zoomLevel: 15, animationDuration: 700 });
  };
  const [heatShape, setHeatShape] = useState<any>(null);
  useEffect(() => {
    if (!heatmapOn) { setHeatShape(null); return; }
    getRuns(1000).then(runs => {
      const lines = runs.filter(r => !r.excluded && (r.gpsPoints?.length ?? 0) > 1).map(r => {
        const step = Math.max(1, Math.floor(r.gpsPoints.length / 300));
        return safeLine(r.gpsPoints.filter((_, i) => i % step === 0).map(p => [p.lng, p.lat]));
      }).filter((l): l is NonNullable<typeof l> => l !== null);
      if (lines.length === 0) { setHeatShape(null); return; }
      setHeatShape({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } });
    }).catch(() => {});
  }, [heatmapOn]);
  // Plan a loop (M2)
  const [planOpen, setPlanOpen] = useState(false);
  // Sheets rise from the bottom; the floating bar would cover them.
  const [zoneExpanded, setZoneExpanded] = useState(false);
  // Friends running right now (mutual follows who share live), as on the mock's map.
  const liveFriends = useLiveFriendRuns();
  const [cheerFor, setCheerFor] = useState<CheerTarget | null>(null);
  const defendZone = (name: string) => {
    const z = selectedPolygon;
    if (!z) return;
    setSelectedPolygon(null);
    // Start a run aimed at this zone: direction and distance on the live screen.
    if (z.ring && z.ring.length >= 4) {
      navigation.navigate('ActiveRun', {
        autoStart: false, activityType: 'run',
        targetZone: { id: z.id, name, ring: z.ring, mode: z.isOwn ? 'defend' : 'attack' },
      });
    } else {
      navigation.navigate('Main', { screen: 'Run' });
    }
  };
  useEffect(() => { setZoneExpanded(false); }, [selectedPolygon?.id]);
  useHideTabBar(planOpen || (!!selectedPolygon && zoneExpanded));
  const [loop, setLoop] = useState<LoopPlan | null>(null);
  const loopZones = useMemo(() => ownPolygons.map(p => ({ ring: p.polygon, fading: p.freshness < ENGINE.FRESHNESS_STALE_AT })), [ownPolygons]);
  const loopShape = useMemo(() => loop && ({
    type: 'Feature' as const, properties: {},
    geometry: { type: 'LineString' as const, coordinates: loop.points.map(p => [p.lng, p.lat]) },
  }), [loop]);
  const showLocationCard = locationStatus !== 'granted' && !locationCardDismissed;

  const cameraRef = useRef<any>(null);
  const isDark = useIsDark();
  const zoneStyles = useMemo(() => territoryLayerStyles(territoryPalette(isDark)), [isDark]);
  // Dark mode opens on the dark basemap; the picker still cycles every style.
  const [styleIdx] = useState(() => (isDark ? 1 : 0));
  const baseStyle = useRunivoMapStyle(MAP_STYLES[styleIdx].url);
  // Follows the screen's own permission state, so the dot appears as soon as
  // the runner allows location from the card below.
  const locationGranted = locationStatus === 'granted';



  const selectedFilter: any = selectedPolygon
    ? ['==', ['get', 'id'], selectedPolygon.id]
    : ['==', ['get', 'id'], ''];

  // Rivals load on map moves; the first view may not count as one, so load
  // around the opening centre too (about the area zoom 13 shows).
  useEffect(() => {
    const [lng, lat] = defaultCenter;
    if (lng === 0 && lat === 0) return;
    const dLat = 0.04, dLng = 0.04 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    handleBboxChange({ minLng: lng - dLng, minLat: lat - dLat, maxLng: lng + dLng, maxLat: lat + dLat });
  }, [defaultCenter, handleBboxChange]);

  function handleRegionChange(feature: any) {
    const bounds = feature?.properties?.visibleBounds;
    if (!bounds) return;
    // MapLibre RN's visibleBounds is [northEast, southWest], not [min, max] — treating
    // it as [min, max] made minLat > maxLat, so the rival-polygon bbox filter could
    // never match and rivals never rendered. Math.min/max over both corners is
    // correct regardless of corner order.
    const [c0, c1] = bounds;
    handleBboxChange({
      minLng: Math.min(c0[0], c1[0]), minLat: Math.min(c0[1], c1[1]),
      maxLng: Math.max(c0[0], c1[0]), maxLat: Math.max(c0[1], c1[1]),
    });
  }

  function handlePolygonPress(e: any) {
    const feat = e.features?.[0];
    if (!feat) { setSelectedPolygon(null); return; }
    const p = feat.properties as any;
    const ring: [number, number][] = feat.geometry?.coordinates?.[0] ?? [];
    const center: [number, number] | undefined = ring.length
      ? [ring.reduce((a, c) => a + c[0], 0) / ring.length, ring.reduce((a, c) => a + c[1], 0) / ring.length]
      : undefined;
    setSelectedPolygon({
      id: p.id, ownerId: p.ownerId, ownerName: p.ownerName,
      isOwn: p.isOwn, freshness: p.freshness, tier: p.tier,
      areaM2: p.areaM2, claimedAt: p.claimedAt, isLoopFill: p.isLoopFill, center, ring,
    });
  }

  const isEmpty = ownLoaded && ownPolygons.length === 0 && rivalPolygons.length === 0 && !isLoadingRivals;

  return (
    <View style={ss.container}>
      <ML.MapView
        style={ss.map}
        mapStyle={baseStyle}
        onRegionDidChange={handleRegionChange}
        logoEnabled={false}
        attributionEnabled
      >
        <ML.Camera
          ref={cameraRef}
          centerCoordinate={safeCenter(defaultCenter)}
          zoomLevel={13}
          animationDuration={0}
        />
        {/* Native dot: MapLibre's JS-animated puck breaks on React Native 0.83 (see patches/). */}
        {/* Under the zones. It used to be placed below "territory-line", which
            didn't exist whenever there were no zones to draw; the zone layers
            are now always mounted, so this anchor is always there. */}
        {heatShape && (
          <ML.ShapeSource id="heatmap" shape={heatShape}>
            <ML.LineLayer id="heatmap-line" belowLayerID="territory-new-halo" style={{ lineColor: zonePal.own, lineOpacity: 0.22, lineWidth: 4, lineCap: 'round', lineJoin: 'round' } as any} />
          </ML.ShapeSource>
        )}
        {/* Always mounted (empty when there's nothing to draw), so layers that
            reference these ids never point at a missing layer. */}
        <ML.ShapeSource id="territories" shape={showZones ? geoJSON : EMPTY_ZONES} onPress={handlePolygonPress}>
          <ML.LineLayer id="territory-new-halo" style={zoneStyles.newHalo as any} filter={zoneStyles.newFilter as any} />
          {/* Flat list, no Fragment: ShapeSource only hands its id to direct children,
              so layers inside a Fragment looked for a source called "composite" and crashed. */}
          {zoneStyles.kinds.flatMap(k => [
            <ML.FillLayer key={`fill-${k.key}`} id={`territory-fill-${k.key}`} filter={k.filter as any} style={k.fill as any} />,
            <ML.LineLayer key={`line-${k.key}`} id={`territory-line-${k.key}`} filter={k.filter as any} style={k.line as any} />,
          ])}
          <ML.LineLayer id="territory-fading" style={zoneStyles.fadingLine as any} filter={zoneStyles.fadingFilter as any} />
          <ML.LineLayer id="territory-selected" style={zoneStyles.selectedLine as any} filter={selectedFilter} />
        </ML.ShapeSource>
        {clubShape && (
          <ML.ShapeSource id="club-ground" shape={clubShape}>
            <ML.FillLayer id="club-ground-fill" style={{ fillColor: '#7C72D8', fillOpacity: 0.28 } as any} />
            <ML.LineLayer id="club-ground-line" style={{ lineColor: '#7C72D8', lineWidth: 2 } as any} />
          </ML.ShapeSource>
        )}
        {showFriends && liveFriends.map(f => (
          <LiveFriendMarker key={f.userId} runner={f} onPress={() => navigation.navigate('FriendLive', { userId: f.userId, username: f.username })} />
        ))}
        {loopShape && (
          <ML.ShapeSource id="planned-loop" shape={loopShape}>
            <ML.LineLayer id="planned-loop-line" style={{ lineColor: C.t1, lineWidth: 4, lineDasharray: [1.5, 1.2], lineCap: 'round', lineJoin: 'round' } as any} />
          </ML.ShapeSource>
        )}
        {/* The runner's arrow last, above zones and routes. */}
        {locationGranted && <PositionArrow id="map" />}
      </ML.MapView>

      <View style={[ss.topOverlay, { top: Math.max(18, insets.top) }]}>
        {/* Opened on top of another screen (run summary, club, Home): it needs a way back.
            As the Map tab it has none, like every tab. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {stacked && (
          <HeaderButton label="Back" onPress={() => navigation.goBack()}>
            <CaretLeft size={20} color={C.t1} weight="bold" />
          </HeaderButton>
        )}
        <View style={{ flex: 1 }}>
        <MapSearchBar
          onFound={coord => cameraRef.current?.setCamera({ centerCoordinate: coord, zoomLevel: 15, animationDuration: 900 })}
          trailing={(
            <Pressable style={ss.savedBtn} onPress={() => navigation.navigate('Main', { screen: 'Run' })} accessibilityRole="button" accessibilityLabel="Saved routes">
              <BookmarkSimple size={17} color={C.t1} />
              <Text style={ss.savedTxt}>Saved</Text>
            </Pressable>
          )}
        />
        </View>
        </View>
        <TerritoryFilterChips
          activeFilter={activeFilter}
          counts={{ mine: ownPolygons.length, rivals: rivalPolygons.length, stale: stats.staleCount }}
          onSelect={setActiveFilter}
        />
        {liveFriends.length > 0 && (
          <Pressable
            style={ss.friendsChip}
            onPress={() => {
              const f = liveFriends[0];
              if (liveFriends.length === 1) navigation.navigate('FriendLive', { userId: f.userId, username: f.username });
              else cameraRef.current?.setCamera({ centerCoordinate: [f.lng, f.lat], zoomLevel: 14, animationDuration: 700 });
            }}
            accessibilityRole="button"
          >
            <View style={ss.friendsDot} />
            <Text style={ss.friendsTxt}>{liveFriends.length === 1 ? `${liveFriends[0].username} is running` : `${liveFriends.length} friends running`}</Text>
          </Pressable>
        )}
        {!planOpen && !selectedPolygon && locationGranted && (
          <Pressable style={[ss.planBtn, { marginTop: 30 }]} onPress={() => setPlanOpen(true)} accessibilityRole="button">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M7 17a5 5 0 1 1 5-5 5 5 0 1 0 5-5" stroke={C.lime} strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
            <Text style={ss.planBtnTxt}>Plan a loop here</Text>
          </Pressable>
        )}
      </View>

      {/* Map controls, right side: personal heatmap and back to you. */}
      {!(selectedPolygon && zoneExpanded) && !planOpen && (
        <View style={[ss.controls, { top: Math.max(18, insets.top) + 200 }]}>
          <Pressable style={ss.ctrl} onPress={() => setLayersOpen(v => !v)} accessibilityRole="button" accessibilityLabel="Map layers" accessibilityState={{ expanded: layersOpen }}>
            <Stack size={22} color={C.t1} />
            <View style={ss.layerBadge}><Text style={ss.layerBadgeTxt}>{[showZones, showFriends, heatmapOn].filter(Boolean).length}</Text></View>
          </Pressable>
          <Pressable
            style={[ss.ctrl, heatmapOn && ss.ctrlOn]} onPress={() => setHeatmapOn(v => !v)}
            accessibilityRole="switch" accessibilityState={{ checked: heatmapOn }} accessibilityLabel="Your heatmap"
          >
            <Fire size={22} color={C.t1} weight={heatmapOn ? 'fill' : 'regular'} />
          </Pressable>
          <Pressable style={ss.ctrl} onPress={recentre} accessibilityRole="button" accessibilityLabel="Centre on me">
            <Crosshair size={22} color={C.t1} />
          </Pressable>
          {layersOpen && (
            <View style={ss.layersCard}>
              {([
                ['Zones', showZones, () => setShowZones(v => !v)],
                ['Friends running', showFriends, () => setShowFriends(v => !v)],
                ['Your heatmap', heatmapOn, () => setHeatmapOn(v => !v)],
              ] as const).map(([label, on, toggle]) => (
                <Pressable key={label} style={ss.layerRow} onPress={toggle} accessibilityRole="switch" accessibilityState={{ checked: on }}>
                  <View style={[ss.layerTick, on && ss.layerTickOn]} />
                  <Text style={ss.layerTxt}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {isLoadingRivals && (
            <View style={ss.ctrl} accessibilityLabel="Loading zones">
              <ArrowsClockwise size={20} color={C.t2} />
            </View>
          )}
        </View>
      )}

      {showLocationCard && (
        <View style={ss.emptyState}>
          <MapPin size={40} color={C.brandGreen} weight="fill" />
          <Text style={ss.emptyTitle}>See the zones on your streets</Text>
          <Text style={ss.emptyBody}>
            Runivo uses your location to show the zones and rivals around you, and to claim ground when you run.
            It's only used while the app is open.
          </Text>
          {locationStatus === 'denied' ? (
            <Pressable style={ss.emptyBtn} onPress={() => Linking.openSettings()}>
              <Text style={ss.emptyBtnText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable style={ss.emptyBtn} onPress={requestLocation}>
              <Text style={ss.emptyBtnText}>Turn on location</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setLocationCardDismissed(true)} hitSlop={8}>
            <Text style={ss.notNow}>Not now</Text>
          </Pressable>
        </View>
      )}

      {isEmpty && !showLocationCard && (
        <View style={ss.emptyState}>
          <MapPin size={40} color={C.brandGreen} weight="fill" />
          <Text style={ss.emptyTitle}>No zones yet</Text>
          <Text style={ss.emptyBody}>Run a loop to claim the ground inside it. Any run of 200 m or more claims the street you ran.</Text>
          <Pressable style={ss.emptyBtn}
            onPress={() => navigation.navigate('Main', { screen: 'Run' })}>
            <Text style={ss.emptyBtnText}>Start a run</Text>
          </Pressable>
        </View>
      )}

      {clubShape && (
        <View style={[ss.clubBanner, { bottom: Math.max(insets.bottom, 16) + 130 }]}>
          <Text style={ss.clubBannerTxt}>{clubName ?? 'Club'} · {clubShape.features.length} zones</Text>
        </View>
      )}
      {planOpen && (
        <PlanLoopSheet
          zones={loopZones}
          bottomInset={insets.bottom + 60}
          onPlan={p => {
            setLoop(p);
            if (p) {
              const lats = p.points.map(q => q.lat), lngs = p.points.map(q => q.lng);
              cameraRef.current?.fitBounds([Math.max(...lngs), Math.max(...lats)], [Math.min(...lngs), Math.min(...lats)], [60, 40, 340, 40], 600);
            }
          }}
          onStart={p => { setPlanOpen(false); setLoop(null); navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', ghostRoutePoints: p.points }); }}
          onClose={() => setPlanOpen(false)}
        />
      )}

      {/* As in the mock: no stats strip; tapping a zone opens its sheet. */}
      {selectedPolygon && !zoneExpanded && (
        <ZoneCard
          polygon={selectedPolygon}
          bottom={Math.max(insets.bottom - 12, 12) + 70 + 20}
          onOpen={() => setZoneExpanded(true)}
          onClose={() => setSelectedPolygon(null)}
          onDefend={defendZone}
        />
      )}
      {selectedPolygon && zoneExpanded && (
        <TerritoryBottomSheet
          polygon={selectedPolygon}
          onClose={() => setSelectedPolygon(null)}
          onDefend={defendZone}
        />
      )}
      <CheerSheet target={cheerFor} onClose={() => setCheerFor(null)} />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    clubBanner: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: '#7C72D8', justifyContent: 'center' },
    clubBannerTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#FFFFFF' },
    planBtn:    { alignSelf: 'center', height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: C.alwaysDark, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    planBtnTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    savedBtn:   { height: 56, paddingHorizontal: 16, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 6 },
    savedTxt:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    controls:   { position: 'absolute', right: 14, gap: 10 },
    ctrl:       { width: 50, height: 50, borderRadius: 25, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#17181A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    ctrlOn:     { backgroundColor: C.amberBg },
    container:    { flex: 1, backgroundColor: C.bg },
    map:          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    topOverlay:   { position: 'absolute', left: 16, right: 16, gap: 10 },
    layerBadge:   { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.brandGreen, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    layerBadgeTxt:{ fontFamily: Fonts.bold, fontSize: 10, color: '#FFFFFF' },
    layersCard:   { position: 'absolute', right: 60, top: 0, width: 190, borderRadius: 20, backgroundColor: C.card, paddingVertical: 6, shadowColor: '#17181A', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    layerRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14 },
    layerTick:    { width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: C.border },
    layerTickOn:  { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    layerTxt:     { fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    friendsChip:  { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.alwaysDark },
    friendsDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime },
    friendsTxt:   { fontFamily: Fonts.medium, fontSize: 13, color: C.alwaysLight },
    searchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    styleBtn:     { width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
    emptyState:   { position: 'absolute', left: 18, right: 18, top: '30%', alignItems: 'center', backgroundColor: C.card, borderRadius: 20, gap: 8, paddingVertical: 24, paddingHorizontal: 22, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    emptyTitle:   { fontFamily: Fonts.semiBold, fontSize: 22, lineHeight: 24, letterSpacing: -0.5, color: C.t1, textAlign: 'center' },
    emptyBody:    { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, textAlign: 'center', marginBottom: 8 },
    emptyBtn:     { backgroundColor: C.alwaysDark, borderRadius: 999, height: 46, justifyContent: 'center', paddingHorizontal: 26 },
    emptyBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    notNow:       { fontFamily: Fonts.medium, fontSize: 14, color: C.t2, marginTop: 4 },
  });
}
