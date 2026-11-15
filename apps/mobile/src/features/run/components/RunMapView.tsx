import React, { useMemo } from 'react';
import { View, Text, Animated, Pressable, StyleSheet } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { Stack, X } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { MAP_STYLES, PLUS_MAP_STYLE_IDS } from '@theme/maps';
import { Lock } from 'lucide-react-native';
import { GPSAcquiringOverlay } from './GPSAcquiringOverlay';

import MapLibreGL from '@maplibre/maplibre-react-native';
import type { TerritoryPolygon } from '@shared/types/game';
import { ZoneLayers } from './ZoneLayers';
import { useLocationGranted } from '@mobile/shared/hooks/useLocationGranted';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';

interface RunMapViewProps {
  lat: number | null;
  lng: number | null;
  gpsStatus: string;
  gpsAccuracy: number | null;
  mapStyle: string;
  onMapStyleChange: (url: string) => void;
  /** Free runners see Terrain and Satellite locked; tapping one opens the paywall. */
  plus?: boolean;
  onLockedStyle?: () => void;
  sheetAnim: Animated.Value;
  topInset: number;
  intelEnemy: number;
  intelWeak: number;
  /** Zones around the runner (yours and rivals'). */
  ownZones?: TerritoryPolygon[];
  rivalZones?: TerritoryPolygon[];
  gpsColor: string;
  gpsLabel: string;
  onClose: () => void;
}

export default function RunMapView({
  lat, lng, gpsStatus, gpsAccuracy, mapStyle, onMapStyleChange, plus = true, onLockedStyle,
  sheetAnim, topInset, intelEnemy, intelWeak, ownZones, rivalZones, gpsColor: dotColor, gpsLabel: gpsTxt,
  onClose,
}: RunMapViewProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [showStylePicker, setShowStylePicker] = React.useState(false);
  const locationGranted = useLocationGranted();
  const baseStyle = useRunivoMapStyle(mapStyle);

  return (
    <Animated.View style={[ss.container, { bottom: sheetAnim }]}>
      <MapLibreGL.MapView style={ss.map} mapStyle={baseStyle} logoEnabled={false} attributionEnabled>
        {lat !== null && lng !== null && (
          <MapLibreGL.Camera
            zoomLevel={15}
            centerCoordinate={[lng, lat]}
            animationMode="flyTo"
            animationDuration={800}
          />
        )}
        <ZoneLayers own={ownZones} rivals={rivalZones} idPrefix="setup" />
        {locationGranted && <MapLibreGL.UserLocation visible renderMode="native" showsUserHeadingIndicator />}
      </MapLibreGL.MapView>

      <View style={[ss.header, { top: topInset + 8 }]}>
        {/* Close button */}
        <Pressable style={ss.closeBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} hitSlop={10}>
          <X size={14} color={C.black} weight="bold" />
        </Pressable>

        {/* GPS pill */}
        <View style={ss.pill}>
          <View style={[ss.dot, { backgroundColor: dotColor }]} />
          <Text style={ss.pillTxt}>{gpsTxt}</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Map style picker */}
        <Pressable style={ss.mapBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Choose map style" onPress={() => { setShowStylePicker(s => !s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Stack size={14} color={C.black} weight="light" />
        </Pressable>
      </View>

      {showStylePicker && (
        <View style={ss.picker}>
          <Text style={ss.pickerLabel}>Map Style</Text>
          {MAP_STYLES.map(s => (
            <Pressable
              key={s.id}
              style={ss.pickerRow}
              onPress={() => {
                setShowStylePicker(false);
                if (!plus && PLUS_MAP_STYLE_IDS.has(s.id)) { onLockedStyle?.(); return; }
                onMapStyleChange(s.url);
              }}
            >
              <View style={[ss.preview, { backgroundColor: s.swatch }, mapStyle === s.url && ss.previewActive]}>
                {!plus && PLUS_MAP_STYLE_IDS.has(s.id) && <Lock size={12} color="#FFFFFF" strokeWidth={2.4} />}
              </View>
              <Text style={[ss.previewLabel, mapStyle === s.url && { color: C.black }]}>{s.label}{!plus && PLUS_MAP_STYLE_IDS.has(s.id) ? ' · Plus' : ''}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {gpsStatus === 'searching' && (
        <GPSAcquiringOverlay accuracy={gpsAccuracy} />
      )}
    </Animated.View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  container:    { position: 'absolute', top: 0, left: 0, right: 0 },
  map:          { flex: 1, minHeight: 300 },
  header:       { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  // These chrome pills sit on top of the map itself, whose basemap can be
  // light or dark independent of C.card — a near-opaque white pill (the old
  // value) paired with C.black text is invisible in dark mode, since C.black
  // inverts to near-white there. C.card is the themed "elevated surface"
  // token, so it inverts correctly on both.
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: C.border },
  dot:          { width: 7, height: 7, borderRadius: 3.5 },
  pillTxt:      { fontFamily: Fonts.regular, fontSize: 12, color: C.black },
  mapBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  picker:       { position: 'absolute', right: 16, top: 60, backgroundColor: C.card, borderRadius: 16, padding: 12, minWidth: 130, borderWidth: 0.5, borderColor: C.border, zIndex: 20 },
  pickerLabel:  { ...Type.overline, color: C.muted, marginBottom: 8 },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  preview:      { width: 28, height: 28, borderRadius: 6, borderWidth: 0.5, borderColor: C.border },
  previewActive:{ borderWidth: 2, borderColor: C.black },
  previewLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.muted },
}); }
