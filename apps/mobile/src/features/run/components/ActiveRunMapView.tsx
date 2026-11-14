/**
 * ActiveRunMapView — full-screen map for the live run screen.
 * Shows: MapLibre tile map · zones around the runner · live GPS trail · user position
 */
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { GPSPoint } from '../hooks/useActiveRun';
import { kalmanSmooth } from '@shared/services/claimEngine';
import type { LiveFriendRunner } from '../hooks/useLiveFriendRuns';
import { LiveFriendMarker } from './LiveFriendMarker';
import type { TerritoryPolygon } from '@shared/types/game';
import { ZoneLayers } from './ZoneLayers';

import MapLibreGL from '@maplibre/maplibre-react-native';
import { territoryPalette } from '@theme/territory';
import { mapStyleUrlFor } from '@theme/maps';
import { useIsDark, useTheme } from '@theme';
import { useLocationGranted } from '@mobile/shared/hooks/useLocationGranted';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';

const styles = StyleSheet.create({
  map: { flex: 1 },
});

interface Props {
  gpsPoints: GPSPoint[];
  isRunning: boolean;
  ghostRoutePoints?: { lat: number; lng: number }[];
  closestIdx?: number;
  /** Style resolved by the run-setup screen (explicit user pick or theme default). */
  mapStyle?: string;
  /** Mutual connections currently running live, visible on this map (Live Run Sharing). */
  liveFriends?: LiveFriendRunner[];
  /** Zones around the runner: yours and rivals', drawn under the trail. */
  ownZones?: TerritoryPolygon[];
  rivalZones?: TerritoryPolygon[];
}


function buildLineString(pts: { lat: number; lng: number }[]) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: pts.map(p => [p.lng, p.lat]) },
    properties: {},
  };
}

export default function ActiveRunMapView({ gpsPoints, ghostRoutePoints, closestIdx = 0, mapStyle, liveFriends, ownZones, rivalZones }: Props) {
  const latest = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;
  const locationGranted = useLocationGranted();
  const isDark = useIsDark();
  const C = useTheme();

  // Prefer whatever the setup screen already resolved (explicit user pick or its
  // own theme default), so the live map never disagrees with the screen before it.
  // Falling back here is theme-driven, not the old "is it nighttime" clock check.
  const resolvedStyle = mapStyle || mapStyleUrlFor(undefined, isDark);
  const baseStyle = useRunivoMapStyle(resolvedStyle);
  // Ghost-route gray needs a different value per basemap: a mid-light gray reads
  // fine on the near-black dark basemap, but nearly disappears at low opacity
  // against the pale positron/voyager basemaps — darken it there for contrast.
  const zone = territoryPalette(isDark);
  const ghostColor = zone.ghost;

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
   
  }, [ghostRoutePoints, closestIdx]);

  const ghostRemainingGeoJSON = useMemo(() => {
    if (!ghostRoutePoints || ghostRoutePoints.length < 2) return null;
    const pts = ghostRoutePoints.slice(closestIdx);
    return pts.length >= 2 ? buildLineString(pts) : null;
   
  }, [ghostRoutePoints, closestIdx]);

  return (
    <MapLibreGL.MapView
      style={styles.map}
      mapStyle={baseStyle}
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

      {/* Zones around the runner, under everything else. Fill fades with freshness. */}
      <ZoneLayers own={ownZones} rivals={rivalZones} idPrefix="run" />

      {/* Ghost route — completed section (solid, muted) */}
      {ghostCompletedGeoJSON && (
        <MapLibreGL.ShapeSource id="ghost-completed" shape={ghostCompletedGeoJSON}>
          <MapLibreGL.LineLayer
            id="ghost-completed-line"
            style={{ lineColor: ghostColor, lineWidth: 2, lineOpacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* Ghost route — remaining section (dashed, visible) */}
      {ghostRemainingGeoJSON && (
        <MapLibreGL.ShapeSource id="ghost-remaining" shape={ghostRemainingGeoJSON}>
          <MapLibreGL.LineLayer
            id="ghost-remaining-line"
            style={{ lineColor: ghostColor, lineWidth: 2.5, lineOpacity: 0.55, lineDasharray: [4, 4], lineCap: 'butt' }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* GPS trail */}
      {trailGeoJSON && (
        <MapLibreGL.ShapeSource id="gps-trail" shape={trailGeoJSON}>
          <MapLibreGL.LineLayer
            id="trail-glow"
            style={{ lineColor: zone.trailGlow, lineWidth: 6, lineOpacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
          />
          <MapLibreGL.LineLayer
            id="trail-line"
            style={{ lineColor: zone.trail, lineWidth: 3, lineOpacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
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
            style={{ circleRadius: 5, circleColor: C.t1, circleOpacity: 1 }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {/* Live friends — mutual connections currently running, if Live Run Sharing shows any */}
      {liveFriends?.map(runner => (
        <LiveFriendMarker key={runner.userId} runner={runner} />
      ))}
    </MapLibreGL.MapView>
  );
}
