/**
 * ActiveRunMapView — full-screen map for the live run screen.
 * Shows: MapLibre tile map · live GPS trail polyline · user position indicator
 * Gracefully falls back to a dark placeholder if MapLibre is not linked.
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GPSPoint } from '../hooks/useActiveRun';
import { kalmanSmooth } from '@shared/services/claimEngine';
import { Fonts } from '@theme';

import MapLibreGL from '@maplibre/maplibre-react-native';

const _hour = new Date().getHours();
const DARK_STYLE = (_hour >= 19 || _hour < 6)
  ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

interface Props {
  gpsPoints: GPSPoint[];
  isRunning: boolean;
  ghostRoutePoints?: { lat: number; lng: number }[];
  closestIdx?: number;
}

function buildLineString(pts: { lat: number; lng: number }[]) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: pts.map(p => [p.lng, p.lat]) },
    properties: {},
  };
}

export default function ActiveRunMapView({ gpsPoints, isRunning, ghostRoutePoints, closestIdx = 0 }: Props) {
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

  // Kalman-smoothed display path — keeps raw gpsPoints for distance/territory calculation
  const displayPath = useMemo(() => {
    if (gpsPoints.length < 3) return gpsPoints;
    return kalmanSmooth(gpsPoints.slice(-200));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsPoints.length]);

  // Build GeoJSON LineString from smoothed display path
  const trailGeoJSON = useMemo((): GeoJSON.Feature<GeoJSON.LineString> | null => {
    if (displayPath.length < 2) return null;
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: displayPath.map(p => [p.lng, p.lat]) },
      properties: {},
    };
  }, [displayPath]);

  // Start dot (first GPS point) — pin lat/lng primitives in dep array (not the object)
  const startDotGeoJSON = useMemo((): GeoJSON.Feature<GeoJSON.Point> | null => {
    if (gpsPoints.length < 1) return null;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [gpsPoints[0].lng, gpsPoints[0].lat] },
      properties: {},
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsPoints[0]?.lat, gpsPoints[0]?.lng]);

  // Ghost route GeoJSON slices — recomputed when points or progress index changes
  const ghostCompletedGeoJSON = useMemo(() => {
    if (!ghostRoutePoints || closestIdx < 1) return null;
    const pts = ghostRoutePoints.slice(0, closestIdx + 1);
    return pts.length >= 2 ? buildLineString(pts) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostRoutePoints, closestIdx]);

  const ghostRemainingGeoJSON = useMemo(() => {
    if (!ghostRoutePoints || ghostRoutePoints.length < 2) return null;
    const pts = ghostRoutePoints.slice(closestIdx);
    return pts.length >= 2 ? buildLineString(pts) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostRoutePoints, closestIdx]);

  return (
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
        ref={cameraRef}
        zoomLevel={latest ? 16 : 14}
        centerCoordinate={latest ? [latest.lng, latest.lat] : undefined}
        animationMode="flyTo"
        animationDuration={800}
      />

      {/* User position dot */}
      <MapLibreGL.UserLocation
        visible
        renderMode="native"
        showsUserHeadingIndicator
      />

      {/* Ghost route — completed section (solid, muted) */}
      {ghostCompletedGeoJSON && (
        <MapLibreGL.ShapeSource id="ghost-completed" shape={ghostCompletedGeoJSON}>
          <MapLibreGL.LineLayer
            id="ghost-completed-line"
            style={{ lineColor: '#9CA3AF', lineWidth: 2, lineOpacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* Ghost route — remaining section (dashed, visible) */}
      {ghostRemainingGeoJSON && (
        <MapLibreGL.ShapeSource id="ghost-remaining" shape={ghostRemainingGeoJSON}>
          <MapLibreGL.LineLayer
            id="ghost-remaining-line"
            style={{ lineColor: '#9CA3AF', lineWidth: 2.5, lineOpacity: 0.55, lineDasharray: [4, 4], lineCap: 'butt' }}
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
  fallbackText: { fontFamily: Fonts.regular, fontSize: 13, color: '#6B7280' },
  fallbackSub:  { fontFamily: Fonts.regular, fontSize: 11, color: '#4B5563' },
});
