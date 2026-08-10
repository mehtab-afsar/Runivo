/**
 * ActiveRunMapView — full-screen map for the live run screen.
 * Shows: MapLibre tile map · live GPS trail polyline · user position indicator
 */
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { GPSPoint } from '../hooks/useActiveRun';
import { kalmanSmooth } from '@shared/services/claimEngine';

import MapLibreGL from '@maplibre/maplibre-react-native';
import { MapStyleUrl } from '@theme/maps';
import { useLocationGranted } from '@mobile/shared/hooks/useLocationGranted';

const styles = StyleSheet.create({
  map: { flex: 1 },
});

const _hour = new Date().getHours();
const DARK_STYLE = (_hour >= 19 || _hour < 6)
  ? MapStyleUrl.darkMatter
  : MapStyleUrl.voyager;

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

export default function ActiveRunMapView({ gpsPoints, ghostRoutePoints, closestIdx = 0 }: Props) {
  const latest = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;
  const locationGranted = useLocationGranted();

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
      style={styles.map}
      mapStyle={DARK_STYLE}
      logoEnabled={false}
      attributionEnabled
      compassEnabled={false}
      zoomEnabled
      rotateEnabled={false}
      scrollEnabled
    >
      <MapLibreGL.Camera
        zoomLevel={latest ? 16 : 14}
        centerCoordinate={latest ? [latest.lng, latest.lat] : undefined}
        animationMode="flyTo"
        animationDuration={800}
      />

      {/* User position dot */}
      {locationGranted && (
        <MapLibreGL.UserLocation
          visible
          renderMode="native"
          showsUserHeadingIndicator
        />
      )}

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
