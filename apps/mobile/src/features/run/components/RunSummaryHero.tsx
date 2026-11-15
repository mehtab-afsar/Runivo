/**
 * RunSummaryHero — top of the Run complete screen, as in the mock:
 * close / "Run complete · 07:42" / Share, a big uppercase headline that says
 * what the run did, a map card with the route and the ground it claimed, and
 * the km · Time · Avg pace row.
 */
import { safeRing, safeLine } from '@mobile/shared/map/geo';
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X, Export, Play } from 'phosphor-react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme, useIsDark, Type, Fonts, Spacing, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import { MapStyleUrl } from '@theme/maps';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';

interface Props {
  topInset:   number;
  /** e.g. "Run complete · 07:42" */
  eyebrow:    string;
  /** Uppercase hero line, e.g. "Claimed a district." */
  headline:   string;
  route:      { lat: number; lng: number }[];
  /** Closed ring [lng, lat][] of the ground this run claimed, if any. */
  zoneRing?:  [number, number][] | null;
  /** e.g. "District · 0.18 km²" */
  zoneLabel?: string | null;
  /** e.g. "Stole 2 zones" — rival-blue chip on the map. */
  stolenLabel?: string | null;
  distance:   string;
  time:       string;
  pace:       string;
  /** Label under the third stat; defaults to "Avg /km". Rides pass "Avg km/h". */
  paceLabel?: string;
  unit?:      'km' | 'mi';
  onClose:    () => void;
  onShare:    () => void;
  onReplay?:  () => void;
}

export default function RunSummaryHero({
  topInset, eyebrow, headline, route, zoneRing, zoneLabel, stolenLabel,
  distance, time, pace, paceLabel, unit = 'km', onClose, onShare, onReplay,
}: Props) {
  const C = useTheme();
  const isDark = useIsDark();
  const baseStyle = useRunivoMapStyle(isDark ? MapStyleUrl.darkMatter : MapStyleUrl.positron);
  const zone = territoryPalette(isDark);
  const ss = useMemo(() => mkStyles(C), [C]);

  // Bad points (NaN, out of range) are dropped before they reach the map.
  const coords = useMemo<[number, number][]>(
    () => safeLine(route.map(p => [p.lng, p.lat])) ?? [],
    [route],
  );
  const ring = useMemo(() => safeRing(zoneRing), [zoneRing]);
  const all = useMemo(() => [...coords, ...(ring ?? [])], [coords, ring]);
  const bounds = useMemo(() => {
    if (all.length < 2) return null;
    const lngs = all.map(c => c[0]);
    const lats = all.map(c => c[1]);
    return {
      ne: [Math.max(...lngs) + 0.0008, Math.max(...lats) + 0.0008] as [number, number],
      sw: [Math.min(...lngs) - 0.0008, Math.min(...lats) - 0.0008] as [number, number],
    };
  }, [all]);

  const routeShape = coords.length >= 2
    ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } }
    : null;
  const zoneShape = ring
    ? { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [ring] } }
    : null;

  return (
    <View style={{ paddingTop: topInset + 8 }}>
      <View style={ss.topBar}>
        <Pressable onPress={onClose} style={ss.roundBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <X size={18} color={C.t1} weight="bold" />
        </Pressable>
        <Text style={ss.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        <Pressable onPress={onShare} style={ss.sharePill} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share your run">
          <Export size={15} color={C.t1} weight="bold" />
          <Text style={ss.shareTxt}>Share</Text>
        </Pressable>
      </View>

      <Text style={ss.headline} accessibilityRole="header">{headline}</Text>

      {bounds && (
        <View style={ss.mapCard}>
          <MapLibreGL.MapView
            style={StyleSheet.absoluteFill}
            mapStyle={baseStyle}
            logoEnabled={false}
            attributionEnabled
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <MapLibreGL.Camera
              bounds={{ ...bounds, paddingTop: 44, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 }}
              animationDuration={0}
            />
            {zoneShape && (
              <MapLibreGL.ShapeSource id="done-zone" shape={zoneShape}>
                <MapLibreGL.FillLayer id="done-zone-fill" style={{ fillColor: zone.own, fillOpacity: 0.26 }} />
                <MapLibreGL.LineLayer id="done-zone-line" style={{ lineColor: zone.own, lineWidth: 3, lineJoin: 'round' }} />
              </MapLibreGL.ShapeSource>
            )}
            {routeShape && (
              <MapLibreGL.ShapeSource id="done-route" shape={routeShape}>
                <MapLibreGL.LineLayer id="done-route-line" style={{ lineColor: zone.trail, lineWidth: zoneShape ? 2 : 4, lineOpacity: zoneShape ? 0.7 : 1, lineCap: 'round', lineJoin: 'round' }} />
              </MapLibreGL.ShapeSource>
            )}
            {coords.length > 0 && (
              <MapLibreGL.PointAnnotation id="done-start" coordinate={coords[0]}>
                <View style={ss.startMarker} />
              </MapLibreGL.PointAnnotation>
            )}
          </MapLibreGL.MapView>
          <View style={ss.mapChips} pointerEvents="box-none">
            {zoneLabel ? <View style={ss.zoneChip}><Text style={ss.zoneChipTxt}>{zoneLabel}</Text></View> : <View />}
            {stolenLabel ? <View style={ss.stolenChip}><Text style={[ss.stolenChipTxt, { color: zone.rival }]}>{stolenLabel}</Text></View> : null}
          </View>
          {onReplay && (
            <Pressable style={ss.replayBtn} onPress={onReplay} hitSlop={8} accessibilityRole="button">
              <Play size={11} color={C.t1} weight="fill" />
              <Text style={ss.replayTxt}>Replay</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={ss.statsCard}>
        <Stat value={distance} label={unit} ss={ss} />
        <Stat value={time} label="Time" ss={ss} divided />
        <Stat value={pace} label={paceLabel ?? `Avg /${unit}`} ss={ss} divided />
      </View>
    </View>
  );
}

function Stat({ value, label, divided, ss }: { value: string; label: string; divided?: boolean; ss: ReturnType<typeof mkStyles> }) {
  return (
    <View style={[ss.stat, divided && ss.statDivided]}>
      <Text style={ss.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={ss.statLabel}>{label}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  const card = {
    backgroundColor: C.card, borderRadius: 18, marginHorizontal: Spacing.gutter,
    shadowColor: '#14120F', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  } as const;
  return StyleSheet.create({
    topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, gap: 10 },
    roundBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    eyebrow:     { flex: 1, textAlign: 'center', fontFamily: Fonts.medium, fontSize: 12, color: C.red },
    sharePill:   { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    shareTxt:    { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },

    headline:    { ...Type.hero, fontSize: 46, lineHeight: 41, color: C.t1, paddingHorizontal: 18, marginTop: 12, marginBottom: 12 },

    mapCard:     { ...card, height: 170, overflow: 'hidden', marginBottom: 12 },
    mapChips:    { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    zoneChip:    { backgroundColor: C.alwaysDark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    zoneChipTxt: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.alwaysLight },
    stolenChip:  { backgroundColor: C.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    stolenChipTxt: { fontFamily: Fonts.semiBold, fontSize: 11.5 },
    startMarker: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: C.t1, backgroundColor: C.card },
    replayBtn:   { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.card },
    replayTxt:   { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },

    statsCard:   { ...card, flexDirection: 'row', paddingVertical: 16, marginBottom: 12 },
    stat:        { flex: 1, paddingHorizontal: 15 },
    statDivided: { borderLeftWidth: 1, borderLeftColor: C.border },
    statValue:   { fontFamily: Fonts.numeric, fontSize: 30, lineHeight: 28, color: C.t1, fontVariant: ['tabular-nums'] },
    statLabel:   { ...Type.labelSm, color: C.t2, marginTop: 5 },
  });
}
