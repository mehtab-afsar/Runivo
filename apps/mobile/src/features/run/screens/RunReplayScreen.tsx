import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Play, Pause, ArrowCounterClockwise, CaretLeft } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, type AppColors } from '@theme';

import MapLibreGL from '@maplibre/maplibre-react-native';

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

type Route = RouteProp<RootStackParamList, 'RunReplay'>;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function paceStr(p: number) {
  const m = Math.floor(p);
  return `${m}:${String(Math.floor((p - m) * 60)).padStart(2, '0')}`;
}

export default function RunReplayScreen() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { route: gpsRoute, durationSec, pace } = route.params;

  const totalPoints = gpsRoute.length;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [speed, setSpeed]           = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrubberWidthRef = useRef(0);

  // Playback loop: advance every 100ms by `speed` points
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= totalPoints - 1) { setIsPlaying(false); return prev; }
        return Math.min(prev + speed, totalPoints - 1);
      });
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, totalPoints]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIdx(0);
  }, []);

  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);

  // Scrubber pan responder
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      setIsPlaying(false);
      const x = e.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(1, x / (scrubberWidthRef.current || 1)));
      setCurrentIdx(Math.round(pct * (totalPoints - 1)));
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(1, x / (scrubberWidthRef.current || 1)));
      setCurrentIdx(Math.round(pct * (totalPoints - 1)));
    },
  }), [totalPoints]);

  // GeoJSON derived from current index
  const fullGeoJSON = useMemo((): any => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: gpsRoute.map(p => [p.lng, p.lat]) },
      properties: {},
    }],
  }), [gpsRoute]);

  const runGeoJSON = useMemo((): any => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: gpsRoute.slice(0, currentIdx + 1).map(p => [p.lng, p.lat]),
      },
      properties: {},
    }],
  }), [gpsRoute, currentIdx]);

  const dotGeoJSON = useMemo((): any => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [gpsRoute[currentIdx].lng, gpsRoute[currentIdx].lat] },
    properties: {},
  }), [gpsRoute, currentIdx]);

  // Derived stats
  const progressPct = totalPoints > 1 ? currentIdx / (totalPoints - 1) : 0;
  const elapsedSec  = Math.round(progressPct * durationSec);
  const coveredKmApprox = (progressPct * (durationSec / 60) / pace).toFixed(2);

  return (
    <View style={ss.root}>
      {/* Stats HUD */}
      <View style={[ss.hud, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={ss.backBtn} hitSlop={12}>
          <CaretLeft size={18} color="#fff" weight="regular" />
        </Pressable>
        <View style={ss.hudStats}>
          <View style={ss.statItem}>
            <Text style={ss.statValue}>{coveredKmApprox}</Text>
            <Text style={ss.statLabel}>km</Text>
          </View>
          <View style={ss.statItem}>
            <Text style={ss.statValue}>{fmt(elapsedSec)}</Text>
            <Text style={ss.statLabel}>elapsed</Text>
          </View>
          <View style={ss.statItem}>
            <Text style={ss.statValue}>{paceStr(pace)}</Text>
            <Text style={ss.statLabel}>avg pace</Text>
          </View>
        </View>
      </View>

      {/* Map */}
      <MapLibreGL.MapView
          style={ss.map}
          mapStyle={DARK_STYLE}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          zoomEnabled
          rotateEnabled={false}
          scrollEnabled
        >
          <MapLibreGL.Camera
            centerCoordinate={[gpsRoute[currentIdx].lng, gpsRoute[currentIdx].lat]}
            zoomLevel={16}
            animationDuration={90}
          />

          {/* Full route — faint gray */}
          <MapLibreGL.ShapeSource id="replay-full" shape={fullGeoJSON}>
            <MapLibreGL.LineLayer
              id="replay-full-line"
              style={{ lineColor: '#6B7280', lineWidth: 2, lineOpacity: 0.35, lineCap: 'round', lineJoin: 'round' }}
            />
          </MapLibreGL.ShapeSource>

          {/* Covered route — red */}
          {currentIdx >= 1 && (
            <MapLibreGL.ShapeSource id="replay-run" shape={runGeoJSON}>
              <MapLibreGL.LineLayer
                id="replay-run-glow"
                style={{ lineColor: '#D93518', lineWidth: 8, lineOpacity: 0.2, lineCap: 'round', lineJoin: 'round' }}
              />
              <MapLibreGL.LineLayer
                id="replay-run-line"
                style={{ lineColor: '#D93518', lineWidth: 3, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
              />
            </MapLibreGL.ShapeSource>
          )}

          {/* Current position dot */}
          <MapLibreGL.ShapeSource id="replay-dot" shape={dotGeoJSON}>
            <MapLibreGL.CircleLayer
              id="replay-dot-outer"
              style={{ circleRadius: 9, circleColor: '#FFFFFF', circleOpacity: 1 }}
            />
            <MapLibreGL.CircleLayer
              id="replay-dot-inner"
              style={{ circleRadius: 6, circleColor: '#D93518', circleOpacity: 1 }}
            />
          </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>

      {/* Controls */}
      <View style={[ss.controls, { paddingBottom: insets.bottom + 12 }]}>
        {/* Scrubber */}
        <View
          style={ss.scrubberWrap}
          onLayout={e => { scrubberWidthRef.current = e.nativeEvent.layout.width; }}
          {...panResponder.panHandlers}
        >
          <View style={ss.scrubberTrack}>
            <View style={[ss.scrubberFill, { width: `${Math.round(progressPct * 100)}%` }]} />
            <View style={[ss.scrubberThumb, { left: `${Math.round(progressPct * 100)}%` }]} />
          </View>
        </View>

        {/* Buttons */}
        <View style={ss.btnRow}>
          <Pressable style={ss.ctrlBtn} onPress={handleReset}>
            <ArrowCounterClockwise size={18} color="#fff" weight="regular" />
          </Pressable>
          <Pressable style={[ss.ctrlBtn, ss.playBtn]} onPress={togglePlay}>
            {isPlaying
              ? <Pause size={22} color="#fff" weight="fill" />
              : <Play  size={22} color="#fff" weight="fill" />
            }
          </Pressable>
          <Pressable
            style={[ss.ctrlBtn, speed === 5 && ss.ctrlBtnActive]}
            onPress={() => setSpeed(5)}
          >
            <Text style={ss.speedTxt}>5×</Text>
          </Pressable>
          <Pressable
            style={[ss.ctrlBtn, speed === 10 && ss.ctrlBtnActive]}
            onPress={() => setSpeed(10)}
          >
            <Text style={ss.speedTxt}>10×</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function mkStyles(_C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: '#0A0A0A' },
    map:          { flex: 1 },
    mapFallback:  { alignItems: 'center', justifyContent: 'center' },
    fallbackText: { fontSize: 13, color: '#6B7280' },
    hud:          { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.6)' },
    backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    hudStats:     { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem:     { alignItems: 'center' },
    statValue:    { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: '#fff' },
    statLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8 },
    controls:     { backgroundColor: '#0F0F0F', paddingTop: 16, paddingHorizontal: 20 },
    scrubberWrap: { paddingVertical: 12 },
    scrubberTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, position: 'relative' },
    scrubberFill:  { position: 'absolute', left: 0, top: 0, height: 4, backgroundColor: '#D93518', borderRadius: 2 },
    scrubberThumb: { position: 'absolute', top: -7, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
    btnRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 4 },
    ctrlBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    ctrlBtnActive: { backgroundColor: '#D93518' },
    playBtn:      { width: 56, height: 56, borderRadius: 28, backgroundColor: '#D93518' },
    speedTxt:     { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: '#fff' },
  });
}
