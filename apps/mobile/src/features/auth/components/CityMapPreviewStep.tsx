/**
 * Location (while using the app): ask with the reason first, then show the
 * runner's own neighbourhood with the real zones and rivals around them.
 * PRD: "This is the moment they get it." Background ("Always") location is
 * asked later, on the first run, when they lock the screen.
 */
import { safeRing } from '@mobile/shared/map/geo';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking, Pressable, ScrollView } from 'react-native';
import { MapPin } from '@mobile/shared/icons/lucideCompat';
import * as Location from 'expo-location';
import ML from '@maplibre/maplibre-react-native';
import { track } from '@shared/services/analytics';
import { supabase } from '@shared/services/supabase';
import { fetchRivalPolygons } from '@features/territory/services/territoryService';
import { MapStyleUrl } from '@theme/maps';
import { territoryPalette, territoryLayerStyles } from '@theme/territory';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { mkStep } from './onboardingStyles';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';

export type LocationPhase = 'prime' | 'asking' | 'granted' | 'denied';

interface Props {
  phase: LocationPhase;
  onPhase: (p: LocationPhase) => void;
  onLocationCaptured: (loc: { lat: number; lng: number }, country: string | null) => void;
}

/** About 1.5 km around the runner. */
const SPAN_DEG = 0.014;

export default function CityMapPreviewStep({ phase, onPhase, onLocationCaptured }: Props) {
  const C = useTheme();
  const isDark = useIsDark();
  const baseStyle = useRunivoMapStyle(isDark ? MapStyleUrl.darkMatter : MapStyleUrl.positron);
  const step = useMemo(() => mkStep(C), [C]);
  const s = useMemo(() => mkStyles(C), [C]);
  const zoneStyles = useMemo(() => territoryLayerStyles(territoryPalette(isDark)), [isDark]);
  const [coord, setCoord] = useState<[number, number] | null>(null);
  const [zones, setZones] = useState<GeoJSON.FeatureCollection | null>(null);
  const [rivals, setRivals] = useState(0);
  // Permission was granted but no fix came back (indoors, GPS still warming up). That is not
  // "Location is off", so it gets its own message instead of the denied screen.
  const [locFailed, setLocFailed] = useState(false);

  // The OS prompt only fires once they've read why (footer "Allow location").
  useEffect(() => {
    if (phase !== 'asking') return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { onPhase('denied'); track('location_permission_denied'); return; }
      track('location_permission_granted');
      let pos: Location.LocationObject;
      try {
        const last = await Location.getLastKnownPositionAsync();
        pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        setLocFailed(true);
        onPhase('granted');
        return;
      }
      const { latitude, longitude } = pos.coords;
      setCoord([longitude, latitude]);
      onPhase('granted');
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        onLocationCaptured({ lat: latitude, lng: longitude }, address?.isoCountryCode ?? address?.country ?? null);
      } catch {
        onLocationCaptured({ lat: latitude, lng: longitude }, null);
      }
      // The real zones around them. Best effort: an empty map still makes the point.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const polys = await fetchRivalPolygons({
          minLat: latitude - SPAN_DEG, maxLat: latitude + SPAN_DEG,
          minLng: longitude - SPAN_DEG, maxLng: longitude + SPAN_DEG,
        }, user?.id ?? '');
        setRivals(new Set(polys.map(p => p.ownerId)).size);
        setZones({
          type: 'FeatureCollection',
          features: polys.flatMap(p => {
            const ring = safeRing(p.polygon);
            return ring ? [{
              type: 'Feature' as const,
              geometry: { type: 'Polygon' as const, coordinates: [ring] },
              properties: { isOwn: false, freshness: p.freshness, isNew: false },
            }] : [];
          }),
        });
      } catch { setZones({ type: 'FeatureCollection', features: [] }); }
    })().catch(() => onPhase('denied'));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'prime' || phase === 'asking') {
    return (
      <ScrollView contentContainerStyle={step.content}>
        <Text style={step.eyebrow}>Your area</Text>
        <Text style={step.title}>Your streets{'\n'}are the board</Text>
        <Text style={step.sub}>
          Runivo uses your location while you’re running to draw your route and claim ground. We never show where you live, and live sharing is off unless you turn it on.
        </Text>
        <View style={[step.card, { alignItems: 'flex-start' }]}>
          <View style={[step.cardIcon, step.cardIconOn]}><MapPin size={22} color={C.red} strokeWidth={2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={step.cardTitle}>Next, your phone will ask</Text>
            <Text style={step.cardSub}>Choose “Allow while using the app”. That’s all Runivo needs to start.</Text>
          </View>
        </View>
        {phase === 'asking' && <ActivityIndicator color={C.red} style={{ marginTop: 18 }} />}
      </ScrollView>
    );
  }

  if (phase === 'denied') {
    return (
      <ScrollView contentContainerStyle={step.content}>
        <Text style={step.eyebrow}>Your area</Text>
        <Text style={step.title}>Location is off</Text>
        <Text style={step.sub}>
          Without it Runivo can’t draw your route or claim zones. You can carry on now and turn it on in Settings before your first run.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} style={[step.chip, step.chipOn, { alignSelf: 'flex-start' }]} accessibilityRole="button">
          <Text style={[step.chipText, step.chipTextOn]}>Open Settings</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={s.container}>
      {coord ? (
        <ML.MapView
          style={{ flex: 1 }}
          mapStyle={baseStyle}
          zoomEnabled={false} scrollEnabled={false} rotateEnabled={false} pitchEnabled={false}
          logoEnabled={false} attributionEnabled
        >
          <ML.Camera centerCoordinate={coord} zoomLevel={14.2} animationDuration={0} />
          {zones && zones.features.length > 0 && (
            <ML.ShapeSource id="onb-zones" shape={zones}>
              {/* Flat list, no Fragment: ShapeSource only hands its id to direct children,
                  so layers inside a Fragment looked for a source called "composite" and crashed. */}
              {zoneStyles.kinds.flatMap(k => [
                <ML.FillLayer key={`fill-${k.key}`} id={`onb-zone-fill-${k.key}`} filter={k.filter as any} style={k.fill as any} />,
                <ML.LineLayer key={`line-${k.key}`} id={`onb-zone-line-${k.key}`} filter={k.filter as any} style={k.line as any} />,
              ])}
            </ML.ShapeSource>
          )}
          <ML.UserLocation visible renderMode="native" />
        </ML.MapView>
      ) : locFailed ? (
        <View style={s.loading}>
          <Text style={[s.body, { textAlign: 'center', paddingHorizontal: 32 }]}>
            We couldn’t find you just yet. That’s fine, Runivo only needs your location while you run. Carry on.
          </Text>
        </View>
      ) : (
        <View style={s.loading}><ActivityIndicator color={C.red} /></View>
      )}

      <View style={s.sheet}>
        <Text style={step.eyebrow}>Around you</Text>
        {locFailed ? (
          <Text style={s.body}>Location is on. We’ll show the zones around you once your phone finds a signal.</Text>
        ) : zones == null ? (
          <ActivityIndicator color={C.red} style={{ alignSelf: 'flex-start' }} />
        ) : zones.features.length > 0 ? (
          <>
            <Text style={s.big}>{zones.features.length} {zones.features.length === 1 ? 'zone' : 'zones'} nearby</Text>
            <Text style={s.body}>
              {rivals} {rivals === 1 ? 'runner holds' : 'runners hold'} ground within about a kilometre. Faded ones are easy to take.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.big}>Nobody owns this yet</Text>
            <Text style={s.body}>No one has claimed your streets. The first loop you close here is yours.</Text>
          </>
        )}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sheet:     {
      position: 'absolute', left: 14, right: 14, bottom: 12, backgroundColor: C.card, borderRadius: 22, padding: 18,
      shadowColor: '#14120F', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
    },
    big:       { fontFamily: Fonts.hero, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: C.t1 },
    body:      { fontFamily: Fonts.regular, fontSize: 14.5, lineHeight: 20, color: C.t2, marginTop: 6 },
  });
}
