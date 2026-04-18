/**
 * ActiveRunMapView — full-screen map for the live run screen.
 * Shows: MapLibre tile map · live GPS trail polyline · user position indicator
 * Gracefully falls back to a dark placeholder if MapLibre is not linked.
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GPSPoint } from '../hooks/useActiveRun';

let MapLibreGL: typeof import('@maplibre/maplibre-react-native') | null = null;
try { MapLibreGL = require('@maplibre/maplibre-react-native'); } catch { /* simulator / Expo Go */ }

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  gpsPoints: GPSPoint[];
  isRunning: boolean;
  ghostRoutePoints?: { lat: number; lng: number }[];
}

export default function ActiveRunMapView({ gpsPoints, isRunning, ghostRoutePoints }: Props) {
  const cameraRef = useRef<any>(null);
  const latest = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;

  // Follow the runner: re-center whenever latest position changes
  useEffect(() => {
    if (!latest || !cameraRef.current || !isRunning) return;
    cameraRef.current.setCamera({
      centerCoordinate: [latest.lng, latest.lat],
      zoomLevel: 16,
      animationDuration: 800,
      animationMode: 'flyTo',
    });
  }, [latest?.lat, latest?.lng, isRunning]);

  // Build GeoJSON LineString from gpsPoints
  const trailGeoJSON = useMemo((): GeoJSON.Feature<GeoJSON.LineString> | null => {
    if (gpsPoints.length < 2) return null;
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: gpsPoints.map(p => [p.lng, p.lat]) },
      properties: {},
    };
  }, [gpsPoints]);

  // Start dot (first GPS point)
  const startDotGeoJSON = useMemo((): GeoJSON.Feature<GeoJSON.Point> | null => {
    if (gpsPoints.length < 1) return null;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [gpsPoints[0].lng, gpsPoints[0].lat] },
      properties: {},
    };
  }, [gpsPoints.length > 0 ? gpsPoints[0] : null]);

  // Ghost route (selected route overlay)
  const ghostGeoJSON = useMemo((): GeoJSON.Feature<GeoJSON.LineString> | null => {
    if (!ghostRoutePoints || ghostRoutePoints.length < 2) return null;
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: ghostRoutePoints.map(p => [p.lng, p.lat]) },
      properties: {},
    };
  }, [ghostRoutePoints]);

  if (!MapLibreGL) {
    return (
      <View style={ss.fallback}>
        <Text style={ss.fallbackText}>Map unavailable</Text>
        {isRunning && <Text style={ss.fallbackSub}>{gpsPoints.length} GPS points recorded</Text>}
      </View>
    );
  }

  return (
    <MapLibreGL.MapView
      style={ss.map}
      mapStyle={DARK_STYLE}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      scrollEnabled={false}
    >
      <MapLibreGL.Camera
        ref={cameraRef}
        zoomLevel={latest ? 16 : 14}
        centerCoordinate={latest ? [latest.lng, latest.lat] : undefined}
        followUserLocation={!latest}
        followZoomLevel={16}
        animationMode="flyTo"
        animationDuration={800}
      />

      {/* User position dot */}
      <MapLibreGL.UserLocation
        visible
        renderMode="native"
        showsUserHeadingIndicator
      />

      {/* Ghost route (selected route, dashed gray) */}
      {ghostGeoJSON && (
        <MapLibreGL.ShapeSource id="ghost-route" shape={ghostGeoJSON}>
          <MapLibreGL.LineLayer
            id="ghost-line"
            style={{ lineColor: '#9CA3AF', lineWidth: 2, lineOpacity: 0.45, lineDasharray: [4, 4], lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* GPS trail */}
      {trailGeoJSON && (
        <MapLibreGL.ShapeSource id="gps-trail" shape={trailGeoJSON}>
          <MapLibreGL.LineLayer
            id="trail-glow"
            style={{ lineColor: '#D93518', lineWidth: 6, lineOpacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
          />
          <MapLibreGL.LineLayer
            id="trail-line"
            style={{ lineColor: '#D93518', lineWidth: 3, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* Start dot */}
      {startDotGeoJSON && (
        <MapLibreGL.ShapeSource id="start-dot" shape={startDotGeoJSON}>
          <MapLibreGL.CircleLayer
            id="start-circle-outer"
            style={{ circleRadius: 7, circleColor: '#FFFFFF', circleOpacity: 1 }}
          />
          <MapLibreGL.CircleLayer
            id="start-circle-inner"
            style={{ circleRadius: 5, circleColor: '#1A6B40', circleOpacity: 1 }}
          />
        </MapLibreGL.ShapeSource>
      )}
    </MapLibreGL.MapView>
  );
}

const ss = StyleSheet.create({
  map:          { flex: 1 },
  fallback:     { flex: 1, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', gap: 6 },
  fallbackText: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#6B7280' },
  fallbackSub:  { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#4B5563' },
});
