import React from 'react';
import { View, Text, Animated, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Layers } from 'lucide-react-native';
import { Colors } from '@theme';

let MapLibreGL: any = null;
try { MapLibreGL = require('@maplibre/maplibre-react-native'); } catch { /* native not available */ }

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_LIGHT = 'Barlow_300Light';

const MAP_STYLES = [
  { id: 'standard', label: 'Standard', preview: '#E8F5E9', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark',     label: 'Dark',     preview: '#263238', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light',    label: 'Light',    preview: '#FAFAFA', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
];

interface RunMapViewProps {
  lat: number | null;
  lng: number | null;
  gpsStatus: string;
  mapStyle: string;
  onMapStyleChange: (url: string) => void;
  sheetAnim: Animated.Value;
  topInset: number;
  intelEnemy: number;
  intelWeak: number;
  gpsColor: string;
  gpsLabel: string;
}

export default function RunMapView({
  lat, lng, gpsStatus, mapStyle, onMapStyleChange,
  sheetAnim, topInset, intelEnemy, intelWeak, gpsColor: dotColor, gpsLabel: gpsTxt,
}: RunMapViewProps) {
  const [showStylePicker, setShowStylePicker] = React.useState(false);

  return (
    <Animated.View style={[ss.container, { bottom: sheetAnim }]}>
      {MapLibreGL ? (
        <MapLibreGL.MapView style={ss.map} mapStyle={mapStyle} logoEnabled={false} attributionEnabled={false}>
          <MapLibreGL.Camera
            zoomLevel={lat !== null && lng !== null ? 15 : 14}
            centerCoordinate={lat !== null && lng !== null ? [lng, lat] : undefined}
            followUserLocation={lat === null || lng === null}
            followZoomLevel={15}
            animationMode="flyTo"
            animationDuration={800}
          />
          <MapLibreGL.UserLocation visible renderMode="native" showsUserHeadingIndicator />
        </MapLibreGL.MapView>
      ) : (
        <View style={[ss.map, ss.fallback]}>
          <Text style={ss.fallbackText}>Map unavailable in simulator</Text>
        </View>
      )}

      <View style={[ss.header, { top: topInset + 8 }]}>
        <View style={ss.pill}>
          <View style={[ss.dot, { backgroundColor: dotColor }]} />
          <Text style={ss.pillTxt}>{gpsTxt}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {(intelEnemy > 0 || intelWeak > 0) && (
          <View style={ss.pill}>
            <View style={[ss.dot, { backgroundColor: C.red }]} />
            <Text style={ss.pillTxt}>{intelEnemy} enemy · {intelWeak} weak</Text>
          </View>
        )}
      </View>

      <View style={ss.rightControls}>
        <Pressable style={ss.mapBtn} onPress={() => { setShowStylePicker(s => !s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Layers size={16} color={C.black} strokeWidth={1.5} />
        </Pressable>
      </View>

      {showStylePicker && (
        <View style={ss.picker}>
          <Text style={ss.pickerLabel}>Map Style</Text>
          {MAP_STYLES.map(s => (
            <Pressable key={s.id} style={ss.pickerRow} onPress={() => { onMapStyleChange(s.url); setShowStylePicker(false); }}>
              <View style={[ss.preview, { backgroundColor: s.preview }, mapStyle === s.url && ss.previewActive]} />
              <Text style={[ss.previewLabel, mapStyle === s.url && { color: C.black }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {gpsStatus === 'searching' && (
        <View style={ss.overlay}>
          <ActivityIndicator color={C.black} size="large" />
          <Text style={ss.overlayTitle}>Fetching GPS</Text>
          <Text style={ss.overlaySub}>Finding your position</Text>
        </View>
      )}
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  container:    { position: 'absolute', top: 0, left: 0, right: 0 },
  map:          { flex: 1, minHeight: 300 },
  fallback:     { backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', height: 300 },
  fallbackText: { fontFamily: FONT, fontSize: 14, color: '#6B7280' },
  header:       { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: C.border },
  dot:          { width: 7, height: 7, borderRadius: 3.5 },
  pillTxt:      { fontFamily: FONT, fontSize: 12, color: C.black },
  rightControls:{ position: 'absolute', right: 16, top: '40%' },
  mapBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  picker:       { position: 'absolute', right: 64, top: '30%', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: 12, minWidth: 130, borderWidth: 0.5, borderColor: C.border },
  pickerLabel:  { fontFamily: FONT_LIGHT, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  preview:      { width: 28, height: 28, borderRadius: 6, borderWidth: 0.5, borderColor: C.border },
  previewActive:{ borderWidth: 2, borderColor: C.black },
  previewLabel: { fontFamily: FONT, fontSize: 12, color: C.muted },
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(247,246,244,0.8)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  overlayTitle: { fontFamily: FONT, fontSize: 14, color: C.black },
  overlaySub:   { fontFamily: FONT_LIGHT, fontSize: 11, color: C.muted },
});
