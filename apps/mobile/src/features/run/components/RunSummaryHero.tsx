/**
 * RunSummaryHero — the post-run "trophy" header.
 *
 * Full-bleed dark hero that makes finishing a run feel earned: the GPS route is
 * drawn on a dark basemap as the backdrop, a gradient scrim keeps the text
 * legible, and the distance is the hero number with Time / Pace / PACE on a rail
 * beneath. Falls back to a solid-dark hero (no map) when there's no usable route
 * (walks, sub-2-point runs, simulator).
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'phosphor-react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';

import MapLibreGL from '@maplibre/maplibre-react-native';

const HERO_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  topInset:    number;
  eyebrow:     string;   // e.g. "ATTACK RUN"
  heading:     string;   // e.g. "Territory Conquered"
  dateLabel:   string;
  success:     boolean;
  distanceKm:  string;   // pre-formatted, e.g. "5.02"
  timeLabel:   string;   // e.g. "27:14"
  paceLabel:   string;   // e.g. "5:26"
  paceEarned:  number;
  route:       { lat: number; lng: number }[];
  onReplay?:   () => void;
}

export default function RunSummaryHero({
  topInset, eyebrow, heading, dateLabel, success,
  distanceKm, timeLabel, paceLabel, paceEarned, route, onReplay,
}: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  const hasRoute = route.length >= 2;
  const coords: [number, number][] = hasRoute ? route.map(p => [p.lng, p.lat]) : [];

  const bounds = useMemo(() => {
    if (!hasRoute) return null;
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    return {
      ne: [Math.max(...lngs) + 0.001, Math.max(...lats) + 0.001] as [number, number],
      sw: [Math.min(...lngs) - 0.001, Math.min(...lats) - 0.001] as [number, number],
    };
  }, [hasRoute, coords]);

  const geojson = hasRoute
    ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } }
    : null;

  return (
    <View style={ss.hero}>
      {/* Map backdrop (or solid dark fallback) */}
      {hasRoute && geojson && bounds ? (
        <MapLibreGL.MapView
          style={StyleSheet.absoluteFill}
          mapStyle={HERO_MAP_STYLE}
          logoEnabled={false}
          attributionEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <MapLibreGL.Camera
            bounds={{ ...bounds, paddingTop: topInset + 40, paddingBottom: 190, paddingLeft: 48, paddingRight: 48 }}
            animationDuration={0}
          />
          <MapLibreGL.ShapeSource id="hero-route" shape={geojson}>
            <MapLibreGL.LineLayer id="hero-route-glow" style={{ lineColor: 'rgba(255,83,38,0.30)', lineWidth: 16, lineBlur: 12, lineCap: 'round', lineJoin: 'round' }} />
            <MapLibreGL.LineLayer id="hero-route-line" style={{ lineColor: C.red, lineWidth: 4, lineOpacity: 0.98, lineCap: 'round', lineJoin: 'round' }} />
          </MapLibreGL.ShapeSource>
          <MapLibreGL.PointAnnotation id="hero-start" coordinate={coords[0]}>
            <View style={[ss.marker, { backgroundColor: C.green }]} />
          </MapLibreGL.PointAnnotation>
          <MapLibreGL.PointAnnotation id="hero-end" coordinate={coords[coords.length - 1]}>
            <View style={[ss.marker, { backgroundColor: C.red }]} />
          </MapLibreGL.PointAnnotation>
        </MapLibreGL.MapView>
      ) : null}

      {/* Scrims: subtle top (for the close button) + heavy bottom (for the text) */}
      <LinearGradient
        colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0)']}
        style={[ss.scrimTop, { height: topInset + 72 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.85)', 'rgba(10,10,10,0.98)']}
        locations={[0, 0.55, 1]}
        style={ss.scrimBottom}
        pointerEvents="none"
      />

      {hasRoute && onReplay && (
        <Pressable style={[ss.replayBtn, { top: topInset + 12 }]} onPress={onReplay} hitSlop={8}>
          <Play size={11} color={C.alwaysLight} weight="fill" />
          <Text style={ss.replayTxt}>Replay</Text>
        </Pressable>
      )}

      {/* Overlaid hero content */}
      <View style={ss.content}>
        <Text style={ss.eyebrow}>{eyebrow}</Text>
        <Text style={[ss.heading, !success && { color: C.red }]}>{heading}</Text>
        <Text style={ss.date}>{dateLabel}</Text>

        <View style={ss.distanceRow}>
          <Text style={ss.distance}>{distanceKm}</Text>
          <Text style={ss.distanceUnit}>km</Text>
        </View>

        <View style={ss.rail}>
          <View style={ss.railItem}>
            <Text style={ss.railValue}>{timeLabel}</Text>
            <Text style={ss.railLabel}>TIME</Text>
          </View>
          <View style={ss.railDivider} />
          <View style={ss.railItem}>
            <Text style={ss.railValue}>{paceLabel}</Text>
            <Text style={ss.railLabel}>PACE /KM</Text>
          </View>
          <View style={ss.railDivider} />
          <View style={ss.railItem}>
            <Text style={[ss.railValue, paceEarned > 0 && { color: C.red }]}>
              {paceEarned > 0 ? `+${paceEarned}` : '—'}
            </Text>
            <Text style={ss.railLabel}>PACE</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    // Fixed-dark trophy surface in both themes.
    hero:         { backgroundColor: C.alwaysDark, minHeight: 360, justifyContent: 'flex-end', overflow: 'hidden' },
    scrimTop:     { position: 'absolute', top: 0, left: 0, right: 0 },
    scrimBottom:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 240 },
    marker:       { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },

    replayBtn:    { position: 'absolute', right: Spacing.gutter, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    replayTxt:    { fontFamily: Fonts.semiBold, fontSize: 12, color: C.alwaysLight, letterSpacing: 0.2 },

    content:      { paddingHorizontal: Spacing.gutter, paddingBottom: 24 },
    eyebrow:      { ...Type.overline, letterSpacing: 1.6, color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
    heading:      { fontFamily: Fonts.display, fontSize: 30, lineHeight: 34, color: C.alwaysLight },
    date:         { fontFamily: Fonts.light, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

    distanceRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 20 },
    distance:     { fontFamily: Fonts.light, fontSize: 76, lineHeight: 78, color: C.alwaysLight, letterSpacing: -3, fontVariant: ['tabular-nums'] },
    distanceUnit: { fontFamily: Fonts.light, fontSize: 22, color: 'rgba(255,255,255,0.5)', paddingBottom: 12 },

    rail:         { flexDirection: 'row', alignItems: 'center', marginTop: 18, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 16 },
    railItem:     { flex: 1 },
    railDivider:  { width: 0.5, height: 30, backgroundColor: 'rgba(255,255,255,0.12)' },
    railValue:    { fontFamily: Fonts.light, fontSize: 26, color: C.alwaysLight, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    railLabel:    { ...Type.overline, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  });
}
