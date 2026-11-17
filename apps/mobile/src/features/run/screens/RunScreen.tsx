import React, { useEffect, useState, useMemo } from 'react';
import { useNearbyZones } from '../hooks/useNearbyZones';
import { useZonesAround } from '../hooks/useZonesAround';
import { sportFor } from '../constants/activities';
import { View, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getSettings, getPlayer, saveRun, type StoredRun } from '@shared/services/store';
import { isPlus } from '@shared/engine/entitlements';
import { postRunSync } from '@shared/services/sync';
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
import { findInterruptedRunCheckpoint, clearInterruptedRunCheckpoint, type GPSPoint } from '../hooks/useActiveRun';
import { stopBackgroundTracking, clearBgGpsBuffer, drainBgGpsBuffer, cleanupOrphanedBackgroundTask } from '../services/locationTask';
import { freshScreenOffFixes } from '../services/screenOffMerge';
import { haversineM } from '@shared/services/claimEngine';
import { formatPace } from '@shared/lib/paceFormat';

/**
 * Reconstructs a full run from a crash checkpoint's raw GPS points and saves it
 * locally so postRunSync() has something to actually push. Previously "Recover"
 * only called postRunSync() (which just pushes already-saved runs) and then
 * deleted the checkpoint — the interrupted run's data was silently lost on the
 * exact path meant to restore it.
 */
async function recoverRunFromCheckpoint(
  runId: string,
  startTime: number,
  points: GPSPoint[],
  activityType: string,
): Promise<void> {
  // Stop the background task first so nothing new lands, then take what it
  // buffered. On Android the live watcher stops with the screen off, so the
  // checkpoint (written from that watcher) is missing every screen-off stretch;
  // the buffer is the only copy. This used to clear it unread.
  await stopBackgroundTracking().catch(() => {});
  const lastTs = points.length ? points[points.length - 1].timestamp : 0;
  const bgFixes = freshScreenOffFixes(lastTs, drainBgGpsBuffer(runId))
    .map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp, speed: p.speed, accuracy: p.accuracy, altitude: 0 }));
  points = [...points, ...bgFixes];

  let distanceM = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineM(points[i - 1], points[i]);
    if (d >= 1 && d < 100) distanceM += d;
  }
  const endTime = points[points.length - 1]?.timestamp ?? Date.now();
  const durationSec = Math.max(1, Math.round((endTime - startTime) / 1000));
  const avgPace = formatPace((distanceM / 1000) / durationSec);

  const run: StoredRun = {
    id: runId,
    activityType,
    startTime,
    endTime,
    distanceMeters: distanceM,
    durationSec,
    avgPace,
    gpsPoints: points,
    territoriesClaimed: [],
    territoriesFortified: [],
    enemyCaptured: 0,
    preRunLevel: 0,
    synced: false,
  };
  await saveRun(run);

  // Only now is the buffer safe to drop: the run, with its points, is on disk.
  clearBgGpsBuffer(runId);
}

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
    activityType, setActivityType, gps, intel,
    savedRoutes, nearbyRoutes, nearbyLoading,
    selectedRoute, setSelectedRoute, todaySession,
    showActivityModal, setShowActivityModal,
    showRouteModal, setShowRouteModal,
    sheetAnim, panResponder,
    openRouteModal, findNearby, startRun,
  } = useRunSetup();
  const zonesAround = useZonesAround(gps.status === 'ready' && gps.lat != null && gps.lng != null ? { lat: gps.lat, lng: gps.lng } : null, sportFor(activityType).claims);
  const nearbyLine = useNearbyZones(gps.status === 'ready' && gps.lat != null && gps.lng != null ? { lat: gps.lat, lng: gps.lng } : null, sportFor(activityType).claims);

  const pacer = useBeatPacer();

  useEffect(() => {
    findInterruptedRunCheckpoint().then(cp => {
      if (!cp || cp.points.length < 2) {
        if (cp) clearInterruptedRunCheckpoint();
        // No recoverable run — if a background task is still registered (e.g. the
        // app was killed before a clean stop), it's orphaned; stop it so it doesn't
        // keep tracking under a dead run id forever.
        cleanupOrphanedBackgroundTask(false).catch(() => {});
        return;
      }
      let m = 0;
      for (let i = 1; i < cp.points.length; i++) { const d = haversineM(cp.points[i - 1], cp.points[i]); if (d >= 1 && d < 100) m += d; }
      const km = (m / 1000).toFixed(1);
      Alert.alert(
        'Interrupted run found',
        `A run was interrupted (~${km} km of GPS data). Recover it?`,
        [
          { text: 'Discard', style: 'destructive', onPress: () => {
            clearInterruptedRunCheckpoint();
            cleanupOrphanedBackgroundTask(false).catch(() => {});
          } },
          { text: 'Recover', onPress: async () => {
            try {
              await recoverRunFromCheckpoint(cp.runId, cp.startTime, cp.points, cp.activityType);
            } catch {
              // Keep the checkpoint: the GPS data is still on the phone and the
              // prompt will offer recovery again next time.
              Alert.alert("Couldn't recover the run", 'Your GPS data is still on this phone. Try again from the Run screen.');
              return;
            }
            clearInterruptedRunCheckpoint();
            // The run is saved locally; a failed upload retries on the next sync.
            postRunSync().catch(() => {});
            // Show the result. Recovering used to end silently, so nobody could tell it worked.
            navigation.navigate('RunSummary', { runId: cp.runId, activityType: cp.activityType });
          } },
        ],
      );
    });
   
  }, []);

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
        intelEnemy={intel.enemy}
        intelWeak={intel.weak}
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
