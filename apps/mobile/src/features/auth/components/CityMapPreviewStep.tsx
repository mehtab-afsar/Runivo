import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { track } from '@shared/services/analytics';
import { mkD, type OnboardingD } from './onboardingStyles';
import { useTheme, Fonts } from '@theme';

import ML from '@maplibre/maplibre-react-native';
import { MapStyleUrl } from '@theme/maps';

const DARK_STYLE = MapStyleUrl.darkMatter;
const LONDON: [number, number] = [-0.1278, 51.5074];

interface Props {
  onLocationCaptured?: (loc: { lat: number; lng: number }, country: string | null) => void;
}

export default function CityMapPreviewStep({ onLocationCaptured }: Props) {
  const C = useTheme();
  const D = useMemo(() => mkD(C), [C]);
  const ss = useMemo(() => mkStyles(D), [D]);
  const [coord, setCoord] = useState<[number, number] | null>(null);
  // MapLibre's native user-location layer raises an NSException from
  // -[MLRNNativeUserLocation setMap:] if it is attached without location
  // authorization, which aborts the process. Rendering it unconditionally meant
  // tapping "Don't Allow" on this step hard-crashed the app on a real device,
  // not just the simulator. Only mount it once permission is actually granted.
  const [locationGranted, setLocationGranted] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setCoord(LONDON); return; }
      setLocationGranted(true);
      // No lat/lng in properties — just the grant event itself.
      track('location_permission_granted');

      const last = await Location.getLastKnownPositionAsync();
      const pos  = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      const { latitude, longitude } = pos.coords;
      setCoord([longitude, latitude]);

      // Best-effort: report the real (permission-granted) position up so onboarding
      // can persist it as the player's last known location for city-rank/leaderboard
      // proximity. Never blocks the map preview itself.
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        onLocationCaptured?.({ lat: latitude, lng: longitude }, address?.country ?? null);
      } catch {
        onLocationCaptured?.({ lat: latitude, lng: longitude }, null);
      }
    })().catch(() => setCoord(LONDON));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const center = coord ?? LONDON;

  return (
    <View style={ss.container}>
      {coord ? (
        <ML.MapView
          style={{ flex: 1 }}
          mapStyle={DARK_STYLE}
          zoomEnabled={false}
          scrollEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          logoEnabled={false}
          attributionEnabled
        >
          <ML.Camera centerCoordinate={center} zoomLevel={14} animationDuration={0} />
          {locationGranted && <ML.UserLocation visible renderMode="native" />}
        </ML.MapView>
      ) : (
        <View style={ss.loading}>
          <ActivityIndicator size="large" color={D.red} />
        </View>
      )}

      <View style={ss.textOverlay}>
        <Text style={ss.overlayEyebrow}>Your empire</Text>
        <Text style={ss.overlayTitle}>Your city awaits.</Text>
        <Text style={ss.overlaySub}>Every run claims new ground. Start anywhere.</Text>
      </View>
    </View>
  );
}

function mkStyles(D: OnboardingD) {
  return StyleSheet.create({
    // Fixed dark — matches DARK_STYLE, the map's own always-dark style, shown
    // briefly before tiles load. Not tied to the app theme.
    container:      { flex: 1, backgroundColor: D.alwaysDark },
    loading:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
    textOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: D.bg, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
    overlayEyebrow: { fontFamily: Fonts.medium, fontSize: 9, color: D.red, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
    overlayTitle:   { fontFamily: Fonts.display, fontSize: 28, color: D.t1, marginBottom: 8, lineHeight: 30 },
    overlaySub:     { fontSize: 13, color: D.t2, lineHeight: 19 },
  });
}
