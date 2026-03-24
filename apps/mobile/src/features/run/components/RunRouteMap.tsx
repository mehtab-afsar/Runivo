/**
 * RunRouteMap — post-run static map showing the GPS trail as a red polyline.
 * Uses MapLibre React Native (already a dep). Falls back gracefully in simulator.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

let MapLibreGL: any = null;
try { MapLibreGL = require('@maplibre/maplibre-react-native'); } catch { /* not available */ }

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const C = { border: '#DDD9D4', t3: '#A39E98', red: '#E8435A', green: '#1A6B40' };

interface Props {
  route: { lat: number; lng: number }[];
}

export default function RunRouteMap({ route }: Props) {
  if (!route || route.length < 2) return null;

  const coords: [number, number][] = route.map(p => [p.lng, p.lat]);

  const minLng = Math.min(...coords.map(c => c[0]));
  const maxLng = Math.max(...coords.map(c => c[0]));
  const minLat = Math.min(...coords.map(c => c[1]));
  const maxLat = Math.max(...coords.map(c => c[1]));
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords },
  };

  if (!MapLibreGL) {
    return (
      <View style={ss.fallback}>
        <Text style={ss.fallbackText}>Map unavailable in simulator</Text>
      </View>
    );
  }

  return (
    <View style={ss.wrap}>
      <MapLibreGL.MapView
        style={ss.map}
        mapStyle={MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapLibreGL.Camera
          bounds={{
            ne: [maxLng + 0.001, maxLat + 0.001],
            sw: [minLng - 0.001, minLat - 0.001],
          }}
          padding={{ paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 }}
          animationDuration={0}
        />
        <MapLibreGL.ShapeSource id="route" shape={geojson}>
          <MapLibreGL.LineLayer
            id="route-glow"
            style={{ lineColor: 'rgba(232,67,90,0.25)', lineWidth: 14, lineBlur: 10 }}
          />
          <MapLibreGL.LineLayer
            id="route-line"
            style={{ lineColor: C.red, lineWidth: 4, lineOpacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>

        {/* Start marker */}
        <MapLibreGL.PointAnnotation id="start" coordinate={coords[0]}>
          <View style={[ss.marker, ss.markerGreen]} />
        </MapLibreGL.PointAnnotation>

        {/* End marker */}
        <MapLibreGL.PointAnnotation id="end" coordinate={coords[coords.length - 1]}>
          <View style={[ss.marker, ss.markerRed]} />
        </MapLibreGL.PointAnnotation>
      </MapLibreGL.MapView>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:         { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: C.border, height: 200 },
  map:          { flex: 1 },
  fallback:     { height: 200, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginHorizontal: 16, marginBottom: 12 },
  fallbackText: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#6B7280' },
  marker:       { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  markerGreen:  { backgroundColor: C.green },
  markerRed:    { backgroundColor: C.red },
});
