import React, { useMemo } from 'react';
import { View, Text, Animated, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stack, X } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { MAP_STYLES } from '@theme/maps';
import { GPSAcquiringOverlay } from './GPSAcquiringOverlay';

import MapLibreGL from '@maplibre/maplibre-react-native';

interface RunMapViewProps {
  lat: number | null;
  lng: number | null;
  gpsStatus: string;
  gpsAccuracy: number | null;
  mapStyle: string;
  onMapStyleChange: (url: string) => void;
  sheetAnim: Animated.Value;
  topInset: number;
  intelEnemy: number;
  intelWeak: number;
  gpsColor: string;
  gpsLabel: string;
  onClose: () => void;
}

export default function RunMapView({
  lat, lng, gpsStatus, gpsAccuracy, mapStyle, onMapStyleChange,
  sheetAnim, topInset, intelEnemy, intelWeak, gpsColor: dotColor, gpsLabel: gpsTxt,
  onClose,
}: RunMapViewProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [showStylePicker, setShowStylePicker] = React.useState(false);

  return (
    <Animated.View style={[ss.container, { bottom: sheetAnim }]}>
      <MapLibreGL.MapView style={ss.map} mapStyle={mapStyle} logoEnabled={false} attributionEnabled>
        {lat !== null && lng !== null && (
          <MapLibreGL.Camera
            zoomLevel={15}
            centerCoordinate={[lng, lat]}
            animationMode="flyTo"
            animationDuration={800}
          />
        )}
        <MapLibreGL.UserLocation visible renderMode="native" showsUserHeadingIndicator />
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
        <Pressable style={ss.mapBtn} onPress={() => { setShowStylePicker(s => !s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Stack size={14} color={C.black} weight="light" />
        </Pressable>
      </View>

      {showStylePicker && (
        <View style={ss.picker}>
          <Text style={ss.pickerLabel}>Map Style</Text>
          {MAP_STYLES.map(s => (
            <Pressable key={s.id} style={ss.pickerRow} onPress={() => { onMapStyleChange(s.url); setShowStylePicker(false); }}>
              <View style={[ss.preview, { backgroundColor: s.swatch }, mapStyle === s.url && ss.previewActive]} />
              <Text style={[ss.previewLabel, mapStyle === s.url && { color: C.black }]}>{s.label}</Text>
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
  fallback:     { backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', height: 300 },
  fallbackText: { fontFamily: Fonts.regular, fontSize: 14, color: '#6B7280' },
  header:       { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: C.border },
  dot:          { width: 7, height: 7, borderRadius: 3.5 },
  pillTxt:      { fontFamily: Fonts.regular, fontSize: 12, color: C.black },
  mapBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  picker:       { position: 'absolute', right: 16, top: 60, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: 12, minWidth: 130, borderWidth: 0.5, borderColor: C.border, zIndex: 20 },
  pickerLabel:  { ...Type.overline, color: C.muted, marginBottom: 8 },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  preview:      { width: 28, height: 28, borderRadius: 6, borderWidth: 0.5, borderColor: C.border },
  previewActive:{ borderWidth: 2, borderColor: C.black },
  previewLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.muted },
}); }
