import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import type { TerritoryPolygon } from '@shared/types/game';
import { useTheme, type AppColors } from '@theme';

import ML from '@maplibre/maplibre-react-native';

const D_RED  = '#C8391A';
const D_GRAY = '#CCCCCC';
const MAP_H  = 180;
interface Props {
  territories: TerritoryPolygon[];
  ownerId: string;
  onPress: () => void;
}

function computeCentroid(territories: TerritoryPolygon[]): [number, number] | null {
  let lngSum = 0, latSum = 0, count = 0;
  for (const t of territories) {
    if (t.polygon.length > 0) {
      lngSum += t.polygon[0][0];
      latSum += t.polygon[0][1];
      count++;
    }
  }
  if (count === 0) return null;
  return [lngSum / count, latSum / count];
}

export function MiniTerritoryMap({ territories, ownerId, onPress }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);

  const owned  = territories.filter(t => t.ownerId === ownerId);
  const others = territories.filter(t => t.ownerId !== ownerId).slice(0, 7);

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then(pos => { if (pos) setUserCoord([pos.coords.longitude, pos.coords.latitude]); })
      .catch(() => {});
  }, []);

  const centroid = useMemo<[number, number] | null>(() => {
    if (userCoord) return userCoord;
    return computeCentroid(owned);
  }, [owned, userCoord]);

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: [
      ...owned.map(t => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [t.polygon] },
        properties: { color: D_RED },
      })),
      ...others.map(t => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [t.polygon] },
        properties: { color: D_GRAY },
      })),
    ],
  }), [owned, others]);

  return (
    <Pressable style={ss.container} onPress={onPress}>
      <ML.MapView
        style={{ flex: 1 }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        zoomEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        {centroid && <ML.Camera centerCoordinate={centroid} zoomLevel={14} animationDuration={0} />}
        <ML.UserLocation visible renderMode="native" />
        {geojson.features.length > 0 && (
          <ML.ShapeSource id="miniHexes" shape={geojson}>
            <ML.FillLayer id="miniHexFill" style={{ fillColor: ['get', 'color'], fillOpacity: 0.3 }} />
            <ML.LineLayer id="miniHexLine" style={{ lineColor: ['get', 'color'], lineWidth: 1, lineOpacity: 0.6 }} />
          </ML.ShapeSource>
        )}
      </ML.MapView>

      {territories.length === 0 && (
        <View style={ss.emptyOverlay}>
          <Text style={ss.emptyText}>Run to claim your first zone</Text>
        </View>
      )}

      <View style={ss.overlay}>
        <Text style={ss.ctaText}>View full map →</Text>
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container:    { height: MAP_H, borderRadius: 20, overflow: 'hidden', marginHorizontal: 22, marginBottom: 28, backgroundColor: C.surface },
    placeholder:  { flex: 1, backgroundColor: C.stone },
    overlay:      { position: 'absolute', bottom: 0, right: 0, left: 0, padding: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
    ctaText:      { fontWeight: '500', fontSize: 11, color: '#fff', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
    emptyOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    emptyText:    { fontSize: 11, color: C.t3, textAlign: 'center' },
  });
}
