/**
 * RunSummaryHero — top of the Run complete screen, as in the mock:
 * close / "Run complete · 07:42" / Share, a big uppercase headline that says
 * what the run did, a map card with the route and the ground it claimed, and
 * the km · Time · Avg pace row.
 */
import { safeRing, safeLine } from '@mobile/shared/map/geo';
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { CaretLeft, Export, Play, Trophy, EyeSlash } from 'phosphor-react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
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
  /** Mock activity page: who, when, what they wrote, a PR line, more stats. */
  authorName?: string;
  /** The runner's photo, shown instead of initials. */
  authorPhoto?: string | null;
  whenLine?:   string;
  description?: string;
  pr?:         { title: string; sub?: string } | null;
  extraStats?: { label: string; value: string }[];
  /** Title in the top bar, e.g. "Run". */
  sportLabel?: string;
  onOpenMap?:  () => void;
}

export default function RunSummaryHero({
  topInset, eyebrow, headline, route, zoneRing, zoneLabel, stolenLabel,
  distance, time, pace, paceLabel, unit = 'km', onClose, onShare, onReplay,
  authorName, authorPhoto, whenLine, description, pr, extraStats = [], sportLabel, onOpenMap,
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

  const initials = (authorName ?? '').replace(/[^a-z0-9 ]/gi, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const stats = [
    { label: 'Distance', value: `${distance} ${unit}` },
    { label: paceLabel ? 'Speed' : 'Pace', value: paceLabel ? `${pace} ${unit}/h` : `${pace} /${unit}` },
    { label: 'Time', value: time },
    ...extraStats,
  ];

  return (
    <View style={{ paddingTop: topInset + 6, backgroundColor: C.card }}>
      <View style={ss.topBar}>
        <Pressable onPress={onClose} style={ss.roundBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <CaretLeft size={18} color={C.t1} weight="bold" />
        </Pressable>
        <Text style={ss.barTitle} numberOfLines={1}>{sportLabel ?? eyebrow}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={onShare} style={ss.roundBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share">
            <Export size={18} color={C.t1} weight="bold" />
          </Pressable>
          {onReplay && (
            <Pressable onPress={onReplay} style={ss.roundBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Replay this run">
              <Play size={16} color={C.t1} weight="fill" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={ss.top}>
        {!!authorName && (
          <View style={ss.author}>
            <View style={ss.authorAv}>{authorPhoto ? <Image source={{ uri: authorPhoto }} style={ss.authorImg} /> : <Text style={ss.authorAvTxt}>{initials}</Text>}</View>
            <View style={{ flex: 1 }}>
              <Text style={ss.authorName} numberOfLines={1}>{authorName}</Text>
              {!!whenLine && <Text style={ss.authorWhen} numberOfLines={1}>{whenLine}</Text>}
            </View>
          </View>
        )}
        <Text style={ss.headline} accessibilityRole="header">{headline}</Text>
        {!!description && <Text style={ss.desc}>{description}</Text>}
        {pr && (
          <View style={ss.pr}>
            <Trophy size={26} color={C.amber} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={ss.prTitle}>{pr.title}</Text>
              {!!pr.sub && <Text style={ss.prSub}>{pr.sub}</Text>}
            </View>
          </View>
        )}
        <View style={ss.grid}>
          {stats.map(x => (
            <View key={x.label} style={ss.cell}>
              <Text style={ss.cellLbl}>{x.label}</Text>
              <Text style={ss.cellVal} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
            </View>
          ))}
        </View>
      </View>

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
              bounds={{ ...bounds, paddingTop: 50, paddingBottom: 50, paddingLeft: 24, paddingRight: 24 }}
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
                <MapLibreGL.LineLayer id="done-route-line" style={{ lineColor: zone.trail, lineWidth: zoneShape ? 2.5 : 4, lineCap: 'round', lineJoin: 'round' }} />
              </MapLibreGL.ShapeSource>
            )}
          </MapLibreGL.MapView>
          <View style={ss.mapChips} pointerEvents="box-none">
            <View style={ss.hiddenChip}><EyeSlash size={14} color="#17181A" weight="bold" /><Text style={ss.hiddenTxt}>Start and end hidden</Text></View>
            {zoneLabel ? <View style={ss.zoneChip}><Text style={ss.zoneChipTxt}>{zoneLabel}</Text></View> : null}
            {stolenLabel ? <View style={ss.stolenChip}><Text style={[ss.stolenChipTxt, { color: zone.rival }]}>{stolenLabel}</Text></View> : null}
          </View>
          {onOpenMap && (
            <Pressable style={ss.openMap} onPress={onOpenMap} hitSlop={8} accessibilityRole="button">
              <Text style={ss.openMapTxt}>Open on map</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 10, height: 50 },
    roundBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    barTitle:    { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    top:         { paddingHorizontal: 20, paddingTop: 10, gap: 14 },
    author:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
    authorAv:    { width: 42, height: 42, borderRadius: 21, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    authorImg:   { width: 42, height: 42 },
    authorAvTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.lime },
    authorName:  { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    authorWhen:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    headline:    { fontFamily: Fonts.semiBold, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, color: C.t1 },
    desc:        { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: C.t1 },
    pr:          { borderRadius: 18, backgroundColor: C.amberBg, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    prTitle:     { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    prSub:       { fontFamily: Fonts.regular, fontSize: 13, color: '#7A5525' },
    grid:        { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, paddingVertical: 4 },
    cell:        { width: '33.33%', paddingRight: 8 },
    cellLbl:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    cellVal:     { fontFamily: Fonts.semiBold, fontSize: 22, color: C.t1, fontVariant: ['tabular-nums'] },

    mapCard:     { height: 230, overflow: 'hidden', marginTop: 6, backgroundColor: C.bg },
    mapChips:    { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' },
    hiddenChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#FFFFFF' },
    hiddenTxt:   { fontFamily: Fonts.semiBold, fontSize: 13, color: '#17181A' },
    zoneChip:    { height: 30, justifyContent: 'center', backgroundColor: C.alwaysDark, borderRadius: 15, paddingHorizontal: 12 },
    zoneChipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.alwaysLight },
    stolenChip:  { height: 30, justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, paddingHorizontal: 12 },
    stolenChipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5 },
    openMap:     { position: 'absolute', right: 12, bottom: 12, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.alwaysDark, justifyContent: 'center' },
    openMapTxt:  { fontFamily: Fonts.medium, fontSize: 13, color: C.alwaysLight },
  });
}
