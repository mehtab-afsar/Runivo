import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import type { TerritoryPolygon } from '@shared/types/game';
import { useTheme, useIsDark, Type, Spacing, type AppColors } from '@theme';
import { territoryPalette, territoryLayerStyles, isNewCapture } from '@theme/territory';
import { computeFreshness } from '@shared/services/claimEngine';

import ML from '@maplibre/maplibre-react-native';
import { MapStyleUrl } from '@theme/maps';
import { useLocationGranted } from '@mobile/shared/hooks/useLocationGranted';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';

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
  const locationGranted = useLocationGranted();

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

  const isDark = useIsDark();
  const baseStyle = useRunivoMapStyle(isDark ? MapStyleUrl.darkMatter : MapStyleUrl.positron);
  const zoneStyles = useMemo(() => territoryLayerStyles(territoryPalette(isDark)), [isDark]);

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: [
      ...owned.map(t => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [t.polygon] },
        properties: { isOwn: true, freshness: computeFreshness(t.lastDefendedAt, t.freshness), isNew: isNewCapture(t.claimedAt) },
      })),
      ...others.map(t => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [t.polygon] },
        properties: { isOwn: false, freshness: computeFreshness(t.lastDefendedAt, t.freshness), isNew: false },
      })),
    ],
  }), [owned, others]);

  return (
    <Pressable style={ss.container} onPress={onPress}>
      <ML.MapView
        style={{ flex: 1 }}
        mapStyle={baseStyle}
        zoomEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        logoEnabled={false}
        attributionEnabled
      >
        {centroid && <ML.Camera centerCoordinate={centroid} zoomLevel={14} animationDuration={0} />}
        {locationGranted && <ML.UserLocation visible renderMode="native" />}
        {geojson.features.length > 0 && (
          <ML.ShapeSource id="miniHexes" shape={geojson}>
            <ML.LineLayer id="miniNewHalo" style={zoneStyles.newHalo as any} filter={zoneStyles.newFilter as any} />
            <ML.FillLayer id="miniHexFill" style={zoneStyles.fill as any} />
            <ML.LineLayer id="miniHexLine" style={zoneStyles.line as any} />
            <ML.LineLayer id="miniFading" style={zoneStyles.fadingLine as any} filter={zoneStyles.fadingFilter as any} />
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
    container:    { height: MAP_H, borderRadius: 20, overflow: 'hidden', marginHorizontal: Spacing.gutter, marginBottom: 28, backgroundColor: C.surface },
    placeholder:  { flex: 1, backgroundColor: C.stone },
    overlay:      { position: 'absolute', bottom: 0, right: 0, left: 0, padding: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
    ctaText:      { ...Type.labelSm, color: C.alwaysLight, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
    emptyOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    // t3 (~1.9:1 contrast) is too low for real guidance copy the user needs to read.
    emptyText:    { ...Type.caption, color: C.t2, textAlign: 'center' },
  });
}
