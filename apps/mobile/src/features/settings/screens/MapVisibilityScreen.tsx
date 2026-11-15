/**
 * Map visibility — Strava's "Edit Map Visibility", for Runivo.
 * Hide 200 m to 1.6 km from the start and end of every activity, or hide all
 * maps. Saved on the profile and enforced by the server, including on past
 * posts (20261112000001_map_visibility.sql).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { ArrowLeft } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import { useIsDark } from '@theme';
import { getRuns } from '@shared/services/store';
import { MAP_HIDE_RADII, visibleMask, radiusLabel, type MapHideRadius } from '@shared/services/mapVisibility';
import { fetchMapVisibility, saveMapVisibility, type MapVisibilitySettings } from '../services/mapVisibilityService';
import { useSettings } from '../hooks/useSettings';

type Pt = { lat: number; lng: number };

/** A gentle loop used when there is no run to preview yet (~2.4 km). */
const SAMPLE: Pt[] = Array.from({ length: 80 }, (_, i) => {
  const t = (i / 79) * Math.PI * 1.85;
  return { lat: 12.97 + 0.0035 * Math.sin(t) + 0.0008 * Math.sin(3 * t), lng: 77.59 + 0.0045 * (1 - Math.cos(t)) };
});

const W = 320, H = 180, PAD = 16;

export default function MapVisibilityScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const zone = territoryPalette(useIsDark());
  const navigation = useNavigation();
  const { updateSetting } = useSettings();
  const [v, setV] = useState<MapVisibilitySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [route, setRoute] = useState<Pt[]>(SAMPLE);
  const [isSample, setIsSample] = useState(true);

  useEffect(() => {
    fetchMapVisibility()
      .then(x => { setV(x); updateSetting({ mapHideRadiusM: x.radiusM, mapHideAll: x.hideAll }); })
      .catch(() => setV({ radiusM: 200, hideAll: false }));
    getRuns(20).then(runs => {
      const r = runs
        .filter(x => (x.gpsPoints?.length ?? 0) >= 10)
        .sort((a, b) => b.startTime - a.startTime)[0];
      if (r) { setRoute(r.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng }))); setIsSample(false); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on open
  }, []);

  const apply = async (next: MapVisibilitySettings) => {
    const prev = v;
    setV(next); setError(null); setNote(null); setSaving(true);
    try {
      const n = await saveMapVisibility(next);
      updateSetting({ mapHideRadiusM: next.radiusM, mapHideAll: next.hideAll });
      setNote(n > 0 ? `Applied to ${n} past ${n === 1 ? 'activity' : 'activities'}.` : 'Saved.');
    } catch {
      setV(prev);
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // Preview: project the route into the box, then draw hidden runs grey and visible runs in your colour.
  const paths = useMemo(() => {
    const lats = route.map(p => p.lat), lngs = route.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const spanX = Math.max(1e-6, (maxLng - minLng) * kx), spanY = Math.max(1e-6, maxLat - minLat);
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
    const ox = (W - spanX * scale) / 2, oy = (H - spanY * scale) / 2;
    const xy = (p: Pt) => [ox + (p.lng - minLng) * kx * scale, H - (oy + (p.lat - minLat) * scale)];
    const mask = visibleMask(route, { radiusM: v?.radiusM, hideAll: v?.hideAll });
    const runs: { visible: boolean; pts: string }[] = [];
    route.forEach((p, i) => {
      const [x, y] = xy(p);
      const cur = runs[runs.length - 1];
      if (cur && cur.visible === mask[i]) cur.pts += ` ${x.toFixed(1)},${y.toFixed(1)}`;
      else {
        // Start the new run at the previous point so the line has no gap.
        const prevPt = i > 0 ? xy(route[i - 1]) : null;
        runs.push({ visible: mask[i], pts: `${prevPt ? `${prevPt[0].toFixed(1)},${prevPt[1].toFixed(1)} ` : ''}${x.toFixed(1)},${y.toFixed(1)}` });
      }
    });
    const [sx, sy] = xy(route[0]);
    const [ex, ey] = xy(route[route.length - 1]);
    return { runs, start: { x: sx, y: sy }, end: { x: ex, y: ey } };
  }, [route, v?.radiusM, v?.hideAll]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>Map visibility</Text>
        <View style={{ width: 32 }} />
      </View>

      {!v ? (
        <View style={s.loading}><ActivityIndicator color={C.t2} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.lead}>
            Choose how much of each route other runners see. It applies to your feed posts, past and future, for every sport.
          </Text>

          {/* Preview */}
          <View style={s.card}>
            <View style={s.previewHead}>
              <Text style={s.label}>{isSample ? 'Preview' : 'Your last activity'}</Text>
              <View style={s.legend}>
                <View style={[s.dot, { backgroundColor: zone.own }]} /><Text style={s.legendTxt}>Others see</Text>
                <View style={[s.dot, { backgroundColor: C.t3, marginLeft: 10 }]} /><Text style={s.legendTxt}>Only you</Text>
              </View>
            </View>
            <View style={s.previewBox}>
              <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
                {paths.runs.map((r, i) => (
                  <Polyline
                    key={i}
                    points={r.pts}
                    fill="none"
                    stroke={r.visible ? zone.own : C.t3}
                    strokeWidth={r.visible ? 3.5 : 2.5}
                    strokeDasharray={r.visible ? undefined : '4 5'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                <Circle cx={paths.start.x} cy={paths.start.y} r={4} fill={C.t3} />
                <Circle cx={paths.end.x} cy={paths.end.y} r={4} fill={C.t3} />
              </Svg>
            </View>
            <Text style={s.caption}>
              {v.hideAll ? 'Your activities post without a map.' : `The first and last ${radiusLabel(v.radiusM)} stay private.`}
            </Text>
          </View>

          {/* Radius */}
          <View style={[s.card, v.hideAll && { opacity: 0.45 }]} pointerEvents={v.hideAll ? 'none' : 'auto'}>
            <Text style={s.rowTitle}>Hide start and end</Text>
            <Text style={s.rowSub}>On every activity, wherever it starts. Never less than 200 m.</Text>
            <View style={s.seg}>
              {MAP_HIDE_RADII.map(r => {
                const on = r === v.radiusM;
                return (
                  <Pressable
                    key={r}
                    style={[s.segItem, on && s.segItemOn]}
                    onPress={() => { if (!on && !saving) apply({ ...v, radiusM: r as MapHideRadius }); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: saving }}
                  >
                    <Text style={[s.segTxt, on && s.segTxtOn]}>{radiusLabel(r)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hide all */}
          <View style={[s.card, s.switchRow]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.rowTitle}>Hide all maps</Text>
              <Text style={s.rowSub}>Distance, time and zones still post. No route is shown to anyone.</Text>
            </View>
            <Switch
              value={v.hideAll}
              disabled={saving}
              onValueChange={hideAll => apply({ ...v, hideAll })}
              trackColor={{ true: C.black, false: C.border }}
              thumbColor={C.white}
            />
          </View>

          <View style={s.status}>
            {saving ? <Text style={s.statusTxt}>Saving…</Text>
              : error ? <Text style={[s.statusTxt, { color: C.red }]}>{error}</Text>
              : note ? <Text style={s.statusTxt}>{note}</Text> : null}
          </View>

          <Text style={s.foot}>
            Hiding the ends helps, but someone who sees many of your routes may still work out where they start. If that matters, hide all maps. You can also hide the map on a single activity from its summary.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn:     { width: 32 },
    title:       { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    loading:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll:      { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
    lead:        { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginBottom: 4 },
    card:        { backgroundColor: C.card, borderRadius: 16, padding: 16 },
    previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    label:       { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    legend:      { flexDirection: 'row', alignItems: 'center' },
    dot:         { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
    legendTxt:   { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t2 },
    previewBox:  { backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden' },
    caption:     { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 10 },
    rowTitle:    { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    rowSub:      { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.t2, marginTop: 3 },
    seg:         { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, padding: 3, marginTop: 12 },
    segItem:     { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    segItemOn:   { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    segTxt:      { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    segTxtOn:    { fontFamily: Fonts.semiBold, color: C.t1 },
    switchRow:   { flexDirection: 'row', alignItems: 'center' },
    status:      { minHeight: 18, paddingHorizontal: 4 },
    statusTxt:   { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    foot:        { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t3, paddingHorizontal: 4 },
  });
}
