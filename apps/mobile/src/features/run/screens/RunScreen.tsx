import React, { useEffect, useState, useMemo } from 'react';
import { useNearbyZones } from '../hooks/useNearbyZones';
import { useZonesAround } from '../hooks/useZonesAround';
import { sportFor } from '../constants/activities';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getSettings, getPlayer } from '@shared/services/store';
import { isPlus } from '@shared/engine/entitlements';
import { useTheme, useIsDark, type AppColors } from '@theme';
import { mapStyleUrlFor } from '@theme/maps';

import { useRunSetup } from '../hooks/useRunSetup';
import { useBeatPacer } from '../hooks/useBeatPacer';
import RunMapView    from '../components/RunMapView';
import RunSetupSheet from '../components/RunSetupSheet';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { SportSheet } from '../components/SportSheet';
import { useLiveFriendRuns } from '../hooks/useLiveFriendRuns';
import { CheerSheet, type CheerTarget } from '@features/cheers/CheerSheet';
import ActivityModal from '../components/ActivityModal';
import RouteModal    from '../components/RouteModal';


function gpsColor(C: AppColors, status: string, acc: number | null): string {
  if (status === 'error') return C.danger;
  if (status === 'searching' || acc === null) return C.t3;
  if (acc < 20) return C.green;
  return C.amber;
}
function gpsLabel(status: string, acc: number | null): string {
  if (status === 'error') return 'GPS error';
  if (status === 'searching' || acc === null) return 'Finding GPS…';
  if (acc < 20) return 'GPS strong';
  return acc < 50 ? 'GPS OK' : 'GPS weak';
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RunScreen() {
  const C = useTheme();
  const isDark = useIsDark();
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const liveFriends = useLiveFriendRuns();
  const [cheerFor, setCheerFor] = useState<CheerTarget | null>(null);
  const navigation = useNavigation<Nav>();
  const [sportsOpen, setSportsOpen] = useState(false);
  const streakDays = usePlayerStats().player?.streakDays ?? 0;
  const [mapStyle, setMapStyle] = useState(() => mapStyleUrlFor(undefined, isDark));
  const [plus, setPlus] = useState(false);

  useEffect(() => {
    // mapStyleUrlFor resolves Terrain/Satellite to their real raster styles.
    // This used to read from a local table where both of those pointed at
    // ordinary CARTO vector styles, so picking "Satellite" silently showed the
    // dark basemap.
    //
    // Passing isDark means: if the user has never explicitly picked a map style,
    // default to dark/light matching the app's own theme instead of always light.
    // An explicit past choice (including a light one) still wins either way.
    // Terrain and Satellite are Plus: a saved one falls back once Plus lapses.
    Promise.all([getSettings(), getPlayer()]).then(([s, p]) => {
      const hasPlus = isPlus(p?.subscriptionTier);
      setPlus(hasPlus);
      setMapStyle(mapStyleUrlFor(s.mapStyle, isDark, hasPlus));
    }).catch(() => {});
  }, [isDark]);

  const {
    activityType, setActivityType, gps,
    savedRoutes, nearbyRoutes, nearbyLoading,
    selectedRoute, setSelectedRoute, todaySession,
    showActivityModal, setShowActivityModal,
    showRouteModal, setShowRouteModal,
    sheetAnim, panResponder,
    openRouteModal, findNearby, startRun,
  } = useRunSetup();
  const zonesAround = useZonesAround(gps.status === 'ready' && gps.lat != null && gps.lng != null ? { lat: gps.lat, lng: gps.lng } : null, sportFor(activityType).claims);
  const nearbyLine = useNearbyZones(gps.status === 'ready' && gps.lat != null && gps.lng != null ? { lat: gps.lat, lng: gps.lng } : null, sportFor(activityType).claims);

  // This is the setup screen's preview. It stays mounted under the live run screen,
  // which has its own pacer, so it must go quiet there or every beat would click twice.
  const pacer = useBeatPacer({ running: useIsFocused() });


  return (
    <View style={ss.root}>
      <RunMapView
        lat={gps.lat}
        lng={gps.lng}
        gpsStatus={gps.status}
        gpsAccuracy={gps.accuracy}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        plus={plus}
        onLockedStyle={() => navigation.navigate('Subscription', { reason: 'map_styles' })}
        sheetAnim={sheetAnim}
        topInset={insets.top}
        ownZones={zonesAround.own}
        rivalZones={zonesAround.rivals}
        gpsColor={gpsColor(C, gps.status, gps.accuracy)}
        gpsLabel={gpsLabel(gps.status, gps.accuracy)}
        liveFriends={liveFriends}
        onFriend={f => setCheerFor({ userId: f.userId, username: f.username, avatarColor: f.avatarColor })}
        onClose={() => navigation.navigate('Main', { screen: 'Dashboard' })}
      />
      <RunSetupSheet
        sheetAnim={sheetAnim}
        panHandlers={panResponder.panHandlers}
        activityType={activityType}
        selectedRouteName={selectedRoute?.name ?? null}
        gpsReady={gps.status === 'ready'}
        gpsProblem={gps.problem}
        bottomInset={insets.bottom}
        pacerEnabled={pacer.enabled}
        pacerPace={pacer.pace}
        pacerPaceOptions={pacer.paceOptions}
        onPacerToggle={() => pacer.setEnabled(!pacer.enabled)}
        onPacerPaceChange={p => pacer.setPace(p)}
        onActivityPress={() => setShowActivityModal(true)}
        onSportChange={setActivityType}
        onMoreSports={() => setSportsOpen(true)}
        streakDays={streakDays}
        onRoutePress={openRouteModal}
        nearbyLine={nearbyLine}
        onStartPress={() => startRun(mapStyle, { enabled: pacer.enabled, pace: pacer.pace })}
      />
      <SportSheet
        visible={sportsOpen} current={activityType} onClose={() => setSportsOpen(false)}
        onPick={setActivityType} onTreadmill={() => navigation.navigate('LogTreadmill')}
      />
      <ActivityModal
        visible={showActivityModal}
        selected={activityType}
        onSelect={type => { setActivityType(type); setShowActivityModal(false); }}
        onClose={() => setShowActivityModal(false)}
      />
      <RouteModal
        visible={showRouteModal}
        savedRoutes={savedRoutes}
        nearbyRoutes={nearbyRoutes}
        nearbyLoading={nearbyLoading}
        gpsReady={gps.status === 'ready'}
        selectedRouteName={selectedRoute?.name ?? null}
        onSelectRoute={(name, pts) => setSelectedRoute({ name, gpsPoints: pts })}
        onClearRoute={() => setSelectedRoute(null)}
        todaySession={todaySession}
        onSelectWorkout={sess => setSelectedRoute({ name: `Today: ${sess.title}`, sessionId: sess.id })}
        onFindNearby={findNearby}
        onClose={() => setShowRouteModal(false)}
      />
      <CheerSheet target={cheerFor} onClose={() => setCheerFor(null)} />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg } });
}
