/**
 * ActiveRunScreen — live run view.
 * Data: useActiveRun (GPS, distance, pace).
 * Navigation: buildRunSummaryParams helper.
 * UI: RunHUD, RunControls, FinishConfirmSheet + 4 live territory banners.
 * Pause state: custom slide-up card (Reanimated 4) instead of native alert.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play, X } from 'phosphor-react-native';
import * as Location from 'expo-location';
import { useActiveRun }          from '../hooks/useActiveRun';
import { postRunSync, createFeedPost } from '@shared/services/sync';
import { getTerritoryPolygons, getPlayer, savePlayer } from '@shared/services/store';
import { track } from '@shared/services/analytics';
import { buildRunSummaryParams }  from '../services/runNavigationHelper';
import { useToast }              from '@mobile/shared/hooks/useToast';
import type { RootStackParamList } from '@navigation/AppNavigator';
import RunHUD             from '../components/RunHUD';
import RunControls        from '../components/RunControls';
import FinishConfirmSheet from '../components/FinishConfirmSheet';
import BeatPacerChip      from '../components/BeatPacerChip';
import ClaimToast         from '../components/ClaimToast';
import ActiveRunMapView   from '../components/ActiveRunMapView';
import { useBeatPacer }   from '../hooks/useBeatPacer';
import { computeRouteProgress, type RouteProgress } from '../utils/routeNavigation';
import { useTheme, feedback, Type, Fonts, type AppColors } from '@theme';
import {
  estimateLiveArea,
  detectLoopClose,
  isNearRivalTerritory,
} from '@shared/services/claimEngine';
import { GAME_CONFIG } from '@shared/services/config';
import { useAuth } from '@shared/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TerritoryPolygon } from '@shared/types/game';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ActiveRun'>;

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveRunScreen() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const ghostRoutePoints = route.params?.ghostRoutePoints;
  const activityType = route.params?.activityType ?? 'run';
  const run  = useActiveRun(activityType);
  const { showToast } = useToast();
  const { user } = useAuth();

  // ── Live territory HUD banners ─────────────────────────────────────────────
  const [liveAreaM2,    setLiveAreaM2]    = useState(0);
  const [speedWarning,  setSpeedWarning]  = useState(false);
  const [loopClosing,   setLoopClosing]   = useState(false);
  const [nearRival,     setNearRival]     = useState(false);
  const [routeProgress, setRouteProgress] = useState<RouteProgress | null>(null);
  // Live capture reward — a one-shot celebratory toast + haptic the moment a loop
  // closes (the in-the-moment "you claimed a zone" payoff that was previously deferred
  // entirely to the post-run summary).
  const [claimEvent,    setClaimEvent]    = useState<{ type: string; paceEarned?: number } | null>(null);
  const rivalPolygonsRef = useRef<TerritoryPolygon[]>([]);

  // Load rival polygons once at run start — rivals don't change mid-run
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    getTerritoryPolygons().then(all => {
      rivalPolygonsRef.current = all.filter(t => t.ownerId !== uid);
    }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update live area estimate every 30s
  useEffect(() => {
    if (!run.isRunning) return;
    const id = setInterval(() => {
      const pts = run.gpsPoints.map(p => ({ ...p }));
      setLiveAreaM2(estimateLiveArea(pts, activityType));
    }, 30_000);
    return () => clearInterval(id);
  }, [run.isRunning, run.gpsPoints, activityType]);

  // Speed warning + loop close: update on each GPS point change
  useEffect(() => {
    if (!run.isRunning || run.gpsPoints.length < 2) return;
    const last = run.gpsPoints[run.gpsPoints.length - 1];
    setSpeedWarning(last.speed > GAME_CONFIG.MAX_RUN_SPEED_MS);
    const first = run.gpsPoints[0];
    setLoopClosing(detectLoopClose(last, first, run.distance * 1000));
    setNearRival(isNearRivalTerritory(last.lat, last.lng, rivalPolygonsRef.current));
    // Ghost route progress
    if (ghostRoutePoints && ghostRoutePoints.length >= 2) {
      setRouteProgress(computeRouteProgress(last.lat, last.lng, ghostRoutePoints));
    }
  }, [run.gpsPoints.length, run.isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOffRoute = run.gpsLocked
    && !!ghostRoutePoints?.length
    && (routeProgress?.distanceToRouteM ?? 0) > 50;

  const isNearRouteEnd = !!ghostRoutePoints?.length
    && (routeProgress?.distanceRemainingM ?? 999) < 100
    && (routeProgress?.distanceRemainingM ?? 999) > 0;

  // GPS locked and rival nearby feedback
  useEffect(() => {
    if (run.gpsLocked) feedback.gpsLocked();
  }, [run.gpsLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nearRival) feedback.rivalNearby();
  }, [nearRival]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire the capture reward once each time a loop closes (this effect only re-runs when
  // loopClosing actually changes, so it won't spam while the runner lingers near start).
  useEffect(() => {
    if (loopClosing) {
      feedback.zoneClaimed();
      setClaimEvent({ type: 'claimed' });
    }
  }, [loopClosing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause card animation ───────────────────────────────────────────────────
  const pauseCardY = useSharedValue(400);
  const pauseCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pauseCardY.value }],
  }));

  useEffect(() => {
    pauseCardY.value = withSpring(run.isPaused ? 0 : 400, { damping: 22, stiffness: 220 });
  }, [run.isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showConfirm, setShowConfirm] = useState(false);
  const pacer = useBeatPacer();

  const doFinish = useCallback(async () => {
    setShowConfirm(false);
    // CRITICAL PATH (adjacent to finishRun/postRunSync): refresh the player's last
    // known location + country from this run's GPS trace, for city-rank/leaderboard
    // proximity. Local-first — savePlayer() writes locally before postRunSync() pushes
    // it to the server below. Best-effort only: any failure here is swallowed and must
    // never block or delay the run finishing or syncing.
    const result = await run.finishRun();
    if (!result) return;
    try {
      const lastPt = result.gpsPoints[result.gpsPoints.length - 1];
      if (lastPt) {
        const [address] = await Location.reverseGeocodeAsync({ latitude: lastPt.lat, longitude: lastPt.lng });
        const player = await getPlayer();
        if (player) {
          await savePlayer({
            ...player,
            lastKnownLocation: { lat: lastPt.lat, lng: lastPt.lng },
            country: address?.country ?? player.country ?? null,
          });
        }
      }
    } catch {
      // non-critical — location/country refresh is best-effort
    }
    const { ok } = await postRunSync();
    if (!ok) {
      showToast({ message: 'Sync failed — run saved locally, will retry when online', type: 'warning', duration: 6000 });
    }
    if (result.run) {
      const { id: runId, distanceMeters } = result.run;
      // CRITICAL PATH (adjacent to finishRun/postRunSync): funnel events, fired after
      // sync so they can't add latency to it. No GPS/lat-lng in properties — ever.
      track('run_completed', {
        distanceKm:   distanceMeters / 1000,
        durationSec:  Math.round(run.elapsed),
        activityType,
      });
      if (result.territory) {
        track('territory_claimed', {
          territoryTier:   result.territory.tier,
          territoryAreaM2: result.territory.areaM2,
        });
      }
      if ((result.paceEarned ?? 0) > 0) {
        track('pace_earned', { paceEarned: result.paceEarned });
      }
      createFeedPost(
        runId,
        distanceMeters / 1000,
        result.territory ? 1 : 0,
        {
          paceEarned:      result.paceEarned,
          territoryTier:   result.territory?.tier ?? null,
          territoryAreaM2: result.territory?.areaM2 ?? null,
          runnerRank:      result.runnerRank,
          durationSec:     Math.round(run.elapsed),
          avgPace:         run.pace,
          activityType:    activityType,
          routePoints:     run.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng })),
        },
      ).catch(() => {});
    }
    nav.replace('RunSummary', buildRunSummaryParams(result as Parameters<typeof buildRunSummaryParams>[0]));
  }, [run, nav, showToast]);

  const handleFinish = useCallback(() => {
    if (run.distance * 1000 < GAME_CONFIG.MIN_MEANINGFUL_RUN_DISTANCE_M && run.elapsed < GAME_CONFIG.MIN_MEANINGFUL_RUN_DURATION_S) {
      Alert.alert('End Run?', "You haven't run far enough. End anyway?", [
        { text: 'Keep Running', style: 'cancel' },
        { text: 'End Run', style: 'destructive', onPress: doFinish },
      ]);
      return;
    }
    setShowConfirm(true);
  }, [run.distance, run.elapsed, doFinish]);

  const handleBack = useCallback(() => {
    if (!run.isRunning) { nav.goBack(); return; }
    Alert.alert('Cancel Run?', 'Your run will be lost.', [
      { text: 'Keep Running', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => {
        // Remove the crash-recovery checkpoint so the user isn't prompted to
        // restore a cancelled run on next app launch.
        const cpKey = `${run.gpsCheckpointPrefix}${run.activeRunId}`;
        AsyncStorage.removeItem(cpKey).catch(() => {});
        nav.goBack();
      }},
    ]);
  }, [run.isRunning, run.activeRunId, run.gpsCheckpointPrefix, nav]);

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      <View style={ss.header}>
        <Pressable onPress={handleBack} style={ss.back} hitSlop={12}><X size={16} color={C.t2} weight="regular" /></Pressable>
        <Text style={ss.title}>{!run.isRunning ? 'Ready to Run' : run.isPaused ? 'Paused' : 'Running'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={ss.map}>
        <ActiveRunMapView gpsPoints={run.gpsPoints} isRunning={run.isRunning} ghostRoutePoints={ghostRoutePoints} closestIdx={routeProgress?.closestIdx ?? 0} />
        {run.isRunning && !run.gpsLocked && (
          <View style={ss.gpsAcquiring}>
            <ActivityIndicator size="small" color={C.red} />
            <Text style={ss.gpsAcquiringText}>Acquiring GPS…</Text>
            <Text style={ss.gpsAcquiringSub}>Move outside for better signal</Text>
          </View>
        )}
        {run.isRunning && (
          <View style={ss.gpsTag}>
            <View style={ss.gpsDot} />
            <Text style={ss.gpsTxt}>GPS Active · {run.gpsPoints.length} pts</Text>
          </View>
        )}
      </View>

      {/* Live territory banners */}
      {run.gpsError && (
        <View style={ss.errBanner}><Text style={ss.errTxt}>{run.gpsError}</Text></View>
      )}
      {run.isRunning && speedWarning && (
        <View style={[ss.banner, ss.bannerRed]}>
          <Text style={ss.bannerTxt}>Too fast — this segment won't earn territory</Text>
        </View>
      )}
      {run.isRunning && loopClosing && !speedWarning && (
        <View style={[ss.banner, ss.bannerTeal]}>
          <Text style={ss.bannerTxt}>Loop closing — keep going to fill the zone</Text>
        </View>
      )}
      {run.isRunning && nearRival && !speedWarning && !loopClosing && (
        <View style={[ss.banner, ss.bannerAmber]}>
          <Text style={ss.bannerTxt}>Rival territory ahead</Text>
        </View>
      )}
      {run.isRunning && isOffRoute && (
        <View style={[ss.banner, ss.bannerAmber]}>
          <Text style={ss.bannerTxt}>Off route — return to the dashed line</Text>
        </View>
      )}
      {run.isRunning && isNearRouteEnd && (
        <View style={[ss.banner, ss.bannerGreen]}>
          <Text style={ss.bannerTxt}>Almost done! {Math.round(routeProgress!.distanceRemainingM)}m to go</Text>
        </View>
      )}

      {/* One-shot capture reward, center-screen, self-dismissing */}
      <ClaimToast event={claimEvent} onDismiss={() => setClaimEvent(null)} />

      <RunHUD
        distance={run.distance}
        pace={run.pace}
        elapsed={run.elapsed}
        liveAreaM2={run.isRunning ? liveAreaM2 : undefined}
      />

      {ghostRoutePoints && routeProgress && run.isRunning && (
        <View style={ss.routeRemaining}>
          <Text style={ss.routeRemainingTxt}>
            {routeProgress.distanceRemainingM >= 1000
              ? `${(routeProgress.distanceRemainingM / 1000).toFixed(1)} km left`
              : `${Math.round(routeProgress.distanceRemainingM)} m left`}
          </Text>
        </View>
      )}

      {run.isRunning && (
        <View style={ss.pacerSection}>
          <Text style={ss.pacerLabel}>BEAT PACER</Text>
          <BeatPacerChip bpm={pacer.bpm} enabled={pacer.enabled} onToggle={() => pacer.setEnabled(!pacer.enabled)} />
        </View>
      )}

      <View style={[ss.controls, { paddingBottom: insets.bottom + 16 }]}>
        {!run.isRunning
          ? <Pressable style={ss.startBtn} onPress={() => { feedback.runStart(); run.startRun(); }}><Play size={28} color={C.white} weight="fill" /></Pressable>
          : !run.isPaused
            ? <RunControls isPaused={false} onPause={run.pauseRun} onResume={run.resumeRun} onStop={handleFinish} />
            : <View style={{ height: 72 }} />
        }
      </View>

      {/* Pause overlay — tap to resume */}
      {run.isPaused && (
        <Pressable style={ss.pauseOverlay} onPress={run.resumeRun} />
      )}

      {/* Pause card */}
      <Animated.View style={[ss.pauseCard, { paddingBottom: insets.bottom + 16 }, pauseCardStyle]}>
        <View style={ss.pauseHandle} />
        <Text style={ss.pauseTitle}>PAUSED</Text>
        <Text style={ss.pauseTime}>{fmtTime(run.elapsed)}</Text>
        <View style={ss.pauseStats}>
          <View style={ss.pauseStat}>
            <Text style={ss.pauseStatVal}>{run.distance.toFixed(2)}</Text>
            <Text style={ss.pauseStatLbl}>km</Text>
          </View>
          <View style={ss.pauseStatDivider} />
          <View style={ss.pauseStat}>
            <Text style={ss.pauseStatVal}>{run.pace}</Text>
            <Text style={ss.pauseStatLbl}>avg pace</Text>
          </View>
        </View>
        <Pressable style={ss.resumeBtn} onPress={run.resumeRun}>
          <Text style={ss.resumeBtnTxt}>Resume</Text>
        </Pressable>
        <Pressable style={ss.pauseFinishBtn} onPress={handleFinish}>
          <Text style={ss.pauseFinishBtnTxt}>Finish run</Text>
        </Pressable>
      </Animated.View>

      {showConfirm && (
        <FinishConfirmSheet
          distance={run.distance}
          elapsed={run.elapsed}
          territoriesClaimed={0}
          bottomInset={insets.bottom}
          onKeepRunning={() => setShowConfirm(false)}
          onFinish={doFinish}
        />
      )}
    </View>
  );
}

// Style-layer-only token sweep (fonts → Fonts/Type, hex → theme tokens); no logic changed.
// The pastel status banners now use theme tokens so they invert correctly in dark mode
// (previously hardcoded light pastels stranded the inverting C.black text).
function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    back:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title:       { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1, letterSpacing: 0.3 },
    map:         { flex: 1, overflow: 'hidden' },
    gpsTag:      { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    gpsDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
    gpsTxt:      { fontFamily: Fonts.medium, fontSize: 10, color: C.white },
    errBanner:   { backgroundColor: C.redLo, padding: 10, alignItems: 'center' },
    errTxt:      { ...Type.labelSm, color: C.red },
    banner:      { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, paddingHorizontal: 16 },
    bannerRed:   { backgroundColor: C.redLo },
    bannerTeal:  { backgroundColor: C.greenBg },
    bannerAmber:      { backgroundColor: C.amberBg },
    bannerGreen:      { backgroundColor: C.greenBg },
    bannerTxt:        { ...Type.caption, color: C.t1 },
    routeRemaining:    { alignItems: 'center', paddingVertical: 4, backgroundColor: C.alwaysDark },
    routeRemainingTxt: { ...Type.caption, color: 'rgba(255,255,255,0.55)' },
    gpsAcquiring:     { position: 'absolute', top: '35%', alignSelf: 'center', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16 },
    gpsAcquiringText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    gpsAcquiringSub:  { ...Type.caption, color: 'rgba(255,255,255,0.6)' },
    pacerSection: { backgroundColor: C.alwaysDark, alignItems: 'center', paddingTop: 8, paddingBottom: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' },
    pacerLabel:   { ...Type.overline, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
    controls:    { backgroundColor: C.alwaysDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 20, paddingHorizontal: 24 },
    startBtn:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', shadowColor: C.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
    // Pause card
    pauseOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
    pauseCard:         { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, zIndex: 11, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
    pauseHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
    pauseTitle:        { ...Type.overline, letterSpacing: 1.4, color: C.t3, textAlign: 'center', marginBottom: 8 },
    pauseTime:         { fontFamily: Fonts.light, fontSize: 52, color: C.t1, textAlign: 'center', letterSpacing: -2, lineHeight: 56, marginBottom: 16, fontVariant: ['tabular-nums'] },
    pauseStats:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 },
    pauseStat:         { alignItems: 'center', gap: 2 },
    pauseStatVal:      { fontFamily: Fonts.semiBold, fontSize: 22, color: C.t1, fontVariant: ['tabular-nums'] },
    pauseStatLbl:      { ...Type.overline, color: C.t3, letterSpacing: 0.6 },
    pauseStatDivider:  { width: 1, height: 32, backgroundColor: C.border },
    resumeBtn:         { backgroundColor: C.alwaysDark, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    resumeBtnTxt:      { ...Type.button, fontSize: 16, color: C.alwaysLight },
    pauseFinishBtn:    { paddingVertical: 12, alignItems: 'center' },
    pauseFinishBtnTxt: { ...Type.bodySm, fontSize: 14, color: C.t3 },
  });
}
