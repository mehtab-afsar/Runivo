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
import { useActiveRun }          from '../hooks/useActiveRun';
import { postRunSync, createFeedPost } from '@shared/services/sync';
import { getTerritoryPolygons } from '@shared/services/store';
import { buildRunSummaryParams }  from '../services/runNavigationHelper';
import { useToast }              from '@mobile/shared/hooks/useToast';
import type { RootStackParamList } from '@navigation/AppNavigator';
import RunHUD             from '../components/RunHUD';
import RunControls        from '../components/RunControls';
import FinishConfirmSheet from '../components/FinishConfirmSheet';
import BeatPacerChip      from '../components/BeatPacerChip';
import ActiveRunMapView   from '../components/ActiveRunMapView';
import { useBeatPacer }   from '../hooks/useBeatPacer';
import { computeRouteProgress, type RouteProgress } from '../utils/routeNavigation';
import { useTheme, feedback, type AppColors } from '@theme';
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
    const result = await run.finishRun();
    if (!result) return;
    const { ok } = await postRunSync();
    if (!ok) {
      showToast({ message: 'Sync failed — run saved locally, will retry when online', type: 'warning', duration: 6000 });
    }
    if (result.run) {
      const { id: runId, distanceMeters } = result.run;
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
    if (run.distance < 0.05 && run.elapsed < 30) {
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
        <Pressable onPress={handleBack} style={ss.back} hitSlop={12}><X size={16} color="#9E9994" weight="regular" /></Pressable>
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    back:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title:       { fontWeight: '600', fontSize: 13, color: C.black, letterSpacing: 0.3 },
    map:         { flex: 1, overflow: 'hidden' },
    gpsTag:      { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    gpsDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
    gpsTxt:      { fontWeight: '500', fontSize: 10, color: C.white },
    errBanner:   { backgroundColor: '#FEF0EE', padding: 10, alignItems: 'center' },
    errTxt:      { fontWeight: '500', fontSize: 11, color: C.red },
    banner:      { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, paddingHorizontal: 16 },
    bannerRed:   { backgroundColor: '#FEF0EE' },
    bannerTeal:  { backgroundColor: '#E6F7F5' },
    bannerAmber:      { backgroundColor: '#FEF8E7' },
    bannerGreen:      { backgroundColor: '#E6F5EC' },
    bannerTxt:        { fontSize: 11, color: C.black },
    routeRemaining:    { alignItems: 'center', paddingVertical: 4, backgroundColor: C.black },
    routeRemainingTxt: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    gpsAcquiring:     { position: 'absolute', top: '35%', alignSelf: 'center', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16 },
    gpsAcquiringText: { fontWeight: '600', fontSize: 14, color: '#fff' },
    gpsAcquiringSub:  { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
    pacerSection: { backgroundColor: C.black, alignItems: 'center', paddingTop: 8, paddingBottom: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' },
    pacerLabel:   { fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
    controls:    { backgroundColor: C.black, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 20, paddingHorizontal: 24 },
    startBtn:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', shadowColor: C.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
    // Pause card
    pauseOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
    pauseCard:         { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, zIndex: 11, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
    pauseHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
    pauseTitle:        { fontWeight: '500', fontSize: 10, letterSpacing: 1.4, color: C.t3, textAlign: 'center', marginBottom: 8 },
    pauseTime:         { fontFamily: 'Barlow_300Light', fontSize: 52, color: C.black, textAlign: 'center', letterSpacing: -2, lineHeight: 56, marginBottom: 16 },
    pauseStats:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 },
    pauseStat:         { alignItems: 'center', gap: 2 },
    pauseStatVal:      { fontFamily: 'Barlow_600SemiBold', fontSize: 22, color: C.black },
    pauseStatLbl:      { fontSize: 10, color: C.t3, letterSpacing: 0.6 },
    pauseStatDivider:  { width: 1, height: 32, backgroundColor: C.border },
    resumeBtn:         { backgroundColor: C.black, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    resumeBtnTxt:      { fontWeight: '600', fontSize: 16, color: '#fff' },
    pauseFinishBtn:    { paddingVertical: 12, alignItems: 'center' },
    pauseFinishBtnTxt: { fontSize: 14, color: C.t3 },
  });
}
