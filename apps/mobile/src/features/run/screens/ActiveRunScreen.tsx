/**
 * ActiveRunScreen — live run view.
 * Data: useActiveRun (GPS, distance, pace).
 * Navigation: buildRunSummaryParams helper.
 * UI: RunHUD, RunControls, FinishConfirmSheet + 4 live territory banners.
 * Pause state: custom slide-up card (Reanimated 4) instead of native alert.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play, X, ShieldCheck, Hexagon } from 'phosphor-react-native';
import * as Location from 'expo-location';
import { useActiveRun }          from '../hooks/useActiveRun';
import { postRunSync, createFeedPost } from '@shared/services/sync';
import { getPlayer, savePlayer, getSettings, getRunById } from '@shared/services/store';
import { useZonesAround } from '../hooks/useZonesAround';
import { useWatchCompanion } from '../hooks/useWatchCompanion';
import CountdownOverlay from '../components/CountdownOverlay';
import { track } from '@shared/services/analytics';
import { buildRunSummaryParams }  from '../services/runNavigationHelper';
import { useToast }              from '@mobile/shared/hooks/useToast';
import { useDistanceUnit }       from '@mobile/shared/hooks/useDistanceUnit';
import { fmtDistShort, convertKm, convertPaceStringPerKm } from '@mobile/shared/lib/formatters';
import type { RootStackParamList } from '@navigation/AppNavigator';
import RunHUD             from '../components/RunHUD';
import RunControls        from '../components/RunControls';
import FinishConfirmSheet from '../components/FinishConfirmSheet';
import BeatPacerChip      from '../components/BeatPacerChip';
import ClaimToast         from '../components/ClaimToast';
import ActiveRunMapView   from '../components/ActiveRunMapView';
import { useLiveFriendRuns } from '../hooks/useLiveFriendRuns';
import { useBeatPacer }   from '../hooks/useBeatPacer';
import { computeRouteProgress, type RouteProgress } from '../utils/routeNavigation';
import { useTheme, useIsDark, feedback, Type, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import {
  estimateLiveArea,
  detectLoopClose,
  isNearRivalTerritory,
  haversineM,
} from '@shared/services/claimEngine';
import { ENGINE } from '@shared/engine/runEngine';
import { sportFor } from '../constants/activities';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TerritoryPolygon } from '@shared/types/game';
import { useWorkoutMode } from '@features/training/hooks/useWorkoutMode';
import WorkoutPanel from '@features/training/components/WorkoutPanel';
import TargetZoneChip from '../components/TargetZoneChip';
import { useVoiceCues } from '../hooks/useVoiceCues';
import { startRunActivity, updateRunActivity, endRunActivity } from '../live/runLiveActivity';
import { startAndSendSafetyShare, pushSafetyPosition, endSafetyShare, isSharing } from '../services/safetyShare';
import type { RunActivityProps } from '../live/RunActivityWidget';
import { targetProgress, routeThroughZone } from '@shared/engine/targetZone';
import LoopCoachCard, { useLoopCoach } from '../components/LoopCoachCard';
import { recordRunAgainstPlan } from '@features/training/services/planService';
import { fmtDuration } from '@shared/engine/training';
import { useIncomingCheers } from '../hooks/useIncomingCheers';
import { CheerToast } from '@features/cheers/CheerToast';
import { CheerSheet, type CheerTarget } from '@features/cheers/CheerSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ActiveRun'>;

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtPaceSecs(secPerUnit: number): string {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0 || secPerUnit > 60 * 30) return '–:––';
  const m = Math.floor(secPerUnit / 60);
  const sec = Math.round(secPerUnit % 60);
  return sec === 60 ? `${m + 1}:00` : `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtArea(m2: number): string {
  return m2 >= 100_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : `${Math.round(m2).toLocaleString()} m²`;
}

export default function ActiveRunScreen() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const zone = territoryPalette(useIsDark());
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  // Defend / Attack (M1): no route given, so draw one out to the zone, around it and back
  // from the first position we know.
  const [zoneRoute, setZoneRoute] = useState<{ lat: number; lng: number }[] | null>(null);
  useEffect(() => {
    const z = route.params?.targetZone;
    if (!z || route.params?.ghostRoutePoints) return;
    Location.getLastKnownPositionAsync().then(fix => {
      if (fix) setZoneRoute(routeThroughZone({ lat: fix.coords.latitude, lng: fix.coords.longitude }, z));
    }).catch(() => {});
  }, [route.params?.targetZone, route.params?.ghostRoutePoints]);
  const ghostRoutePoints = route.params?.ghostRoutePoints ?? zoneRoute ?? undefined;
  const activityType = route.params?.activityType ?? 'run';
  // Rides are tracked only: no loop, no zone, speed instead of pace.
  const sport = sportFor(activityType);
  const mapStyle = route.params?.mapStyle;
  const run  = useActiveRun(activityType);
  const coach = useLoopCoach(sportFor(activityType).claims && run.isRunning && !route.params?.sessionId, run.distance);
  const workout = useWorkoutMode(route.params?.sessionId, run.isRunning && !run.isPaused, run.elapsed, run.distance);
  const liveFriends = useLiveFriendRuns();
  const { showToast } = useToast();
  const distanceUnit = useDistanceUnit();

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
  const [friendsShown,  setFriendsShown]  = useState(true);
  const [sharingLive,   setSharingLive]   = useState(false);
  // Cheers only reach a runner whose live position friends can see.
  const [cheerFor, setCheerFor] = useState<CheerTarget | null>(null);
  const cheers = useIncomingCheers(run.isRunning && sharingLive, run.player?.id, run.player?.username ?? '');
  const lapStartRef  = useRef({ idx: 0, elapsed: 0, dist: 0 });
  const farthestRef  = useRef(0);
  useEffect(() => { getSettings().then(st => setSharingLive(!!st?.liveRunSharingEnabled)).catch(() => {}); }, []);
  const [countdown,     setCountdown]     = useState<number | null>(null);
  const rivalPolygonsRef = useRef<TerritoryPolygon[]>([]);

  const handleStartPress = useCallback(async () => {
    const settings = await getSettings().catch(() => null);
    const seconds = settings?.countdownSeconds ?? 0;
    if (seconds > 0) {
      setCountdown(seconds);
    } else {
      feedback.runStart();
      run.startRun();
    }
  }, [run]);

  // Arriving from a Start button: begin straight away (countdown still applies).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!route.params?.autoStart || autoStarted.current || run.isRunning) return;
    autoStarted.current = true;
    handleStartPress();
  }, [route.params?.autoStart, run.isRunning, handleStartPress]);

  // Zones around the runner, for the map and the "rival nearby" alert. The
  // phone only stores the runner's own zones, so this used to read an empty
  // rival list: the alert never fired and the live map showed no zones.
  const lastFix = run.gpsPoints.length ? run.gpsPoints[run.gpsPoints.length - 1] : null;
  const mapZones = useZonesAround(lastFix ? { lat: lastFix.lat, lng: lastFix.lng } : null, sport.claims);
  useEffect(() => { rivalPolygonsRef.current = mapZones.rivals; }, [mapZones.rivals]);

  // Update live area estimate every 15s (same shape rules as the finished run). gpsPoints is read from a ref (updated by the
  // effect below) rather than a dependency — run.gpsPoints is a new array reference on
  // almost every render while running, which previously tore down and recreated this
  // interval before its 30s callback ever had a chance to fire, leaving the live
  // territory-area HUD stuck at 0 for the entire run.
  const gpsPointsRef = useRef(run.gpsPoints);
  useEffect(() => { gpsPointsRef.current = run.gpsPoints; }, [run.gpsPoints]);

  useEffect(() => {
    if (!run.isRunning) return;
    const id = setInterval(() => {
      const pts = gpsPointsRef.current.map(p => ({ ...p }));
      setLiveAreaM2(estimateLiveArea(pts, activityType));
    }, 15_000);
    return () => clearInterval(id);
  }, [run.isRunning, activityType]);

  // Speed warning + loop close: update on each GPS point change
  useEffect(() => {
    if (!run.isRunning || run.gpsPoints.length < 2) return;
    const last = run.gpsPoints[run.gpsPoints.length - 1];
    setSpeedWarning(last.speed > (sport.claims ? ENGINE.MAX_TERRITORY_SPEED_MS : ENGINE.MAX_RIDE_SEGMENT_SPEED_MS));
    const first = run.gpsPoints[0];
    // Same test as the finished run: back near any earlier part of the route.
    if (sport.claims) {
      setLoopClosing(detectLoopClose(last, first, run.distance * 1000, run.gpsPoints));
      setNearRival(isNearRivalTerritory(last.lat, last.lng, rivalPolygonsRef.current));
    }
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
  }, [run.gpsLocked]);  

  useEffect(() => {
    if (nearRival) feedback.rivalNearby();
  }, [nearRival]);  

  // Fire the capture reward once each time a loop closes (this effect only re-runs when
  // loopClosing actually changes, so it won't spam while the runner lingers near start).
  useEffect(() => {
    if (loopClosing) {
      feedback.zoneClaimed();
      setClaimEvent({ type: 'claimed' });
    }
  }, [loopClosing]);  

  // ── Pause card animation ───────────────────────────────────────────────────
  const pauseCardY = useSharedValue(400);
  const pauseCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pauseCardY.value }],
  }));

  useEffect(() => {
    pauseCardY.value = withSpring(run.isPaused ? 0 : 400, { damping: 22, stiffness: 220 });
  }, [run.isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showConfirm, setShowConfirm] = useState(false);
  // Seeded from the setup screen's already-resolved choice (see useRunSetup.startRun)
  // so this screen's own pacer instance ticks from its first render instead of
  // waiting on an async settings read — closes the audible gap at run start.
  const pacer = useBeatPacer({ enabled: route.params?.pacerEnabled, pace: route.params?.pacerPace });

  // Leaving mid-run (Android back button) used to drop the run without asking.
  // Finish and Discard set this before they navigate away.
  const allowLeaveRef = useRef(false);
  const runningRef = useRef(false);
  runningRef.current = run.isRunning;

  const doFinish = useCallback(async () => {
    setShowConfirm(false);
    allowLeaveRef.current = true;
    // CRITICAL PATH (adjacent to finishRun/postRunSync): refresh the player's last
    // known location + country from this run's GPS trace, for city-rank/leaderboard
    // proximity. Local-first — savePlayer() writes locally before postRunSync() pushes
    // it to the server below. Best-effort only: any failure here is swallowed and must
    // never block or delay the run finishing or syncing.
    const result = await run.finishRun();
    if (!result) {
      allowLeaveRef.current = false;
      Alert.alert(
        'Could not save run',
        'Something went wrong saving your run. Your GPS data is safe — try again.',
        [{ text: 'Retry', onPress: doFinish }],
      );
      return;
    }
    // The run is saved on the phone. Open the summary now: it shows the
    // phone's numbers straight away and fills in the server's verdict when the
    // sync below lands. Waiting for the sync first (location lookup, upload,
    // retries with backoff) froze this screen after Finish on a weak signal.
    const elapsedSec = Math.round(run.elapsed);
    const avgPace = run.pace;
    const routePoints = run.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng }));
    nav.replace('RunSummary', { ...buildRunSummaryParams(result as Parameters<typeof buildRunSummaryParams>[0]), activityType });

    void (async () => {
      try {
        const lastPt = result.gpsPoints[result.gpsPoints.length - 1];
        if (lastPt) {
          const [address] = await Location.reverseGeocodeAsync({ latitude: lastPt.lat, longitude: lastPt.lng });
          const player = await getPlayer();
          if (player) {
            await savePlayer({
              ...player,
              // Rounded to about 1 km: a run usually ends at the runner's door,
              // and this is what the server keeps as their home area.
              lastKnownLocation: { lat: Math.round(lastPt.lat * 100) / 100, lng: Math.round(lastPt.lng * 100) / 100 },
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
        // Tick off the matching plan session (on-foot only; best-effort, never blocks).
        if (sportFor(activityType).claims) {
          recordRunAgainstPlan({ runId, startTime: result.run.startTime ?? Date.now(), distanceKm: distanceMeters / 1000, durationSec: elapsedSec })
            .then(({ session, fasterFiveK }) => {
              if (fasterFiveK) showToast({ message: `You're getting faster: plan paces updated (5K ${fmtDuration(fasterFiveK)})`, type: 'success', duration: 6000 });
              else if (session) showToast({ message: `Plan: ${session.title} done`, type: 'success' });
            })
            .catch(() => {});
        }
        // CRITICAL PATH (adjacent to finishRun/postRunSync): funnel events, fired after
        // sync so they can't add latency to it. No GPS/lat-lng in properties — ever.
        track('run_completed', {
          distanceKm:   distanceMeters / 1000,
          durationSec:  elapsedSec,
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
        // Sync has finished by now, so the server's PACE is on the stored run
        // (cap and verified distance applied); the feed card shows that one.
        const stored = ok ? await getRunById(runId).catch(() => undefined) : undefined;
        const feedPace = stored?.serverProcessed && typeof stored.xpEarned === 'number' ? stored.xpEarned : result.paceEarned;
        createFeedPost(
          runId,
          distanceMeters / 1000,
          result.territory ? 1 : 0,
          {
            paceEarned:      feedPace,
            territoryTier:   result.territory?.tier ?? null,
            territoryAreaM2: result.territory?.areaM2 ?? null,
            runnerRank:      result.runnerRank,
            durationSec:     elapsedSec,
            avgPace:         avgPace,
            activityType:    activityType,
            routePoints:     routePoints,
          },
        ).catch(() => {});
      }
    })().catch(() => {});
  }, [run, nav, showToast, activityType]);

  const handleFinish = useCallback(() => {
    // Either one short is enough: a 0 m run left running for a minute used to
    // save without a warning (&&), and the server rejects anything under
    // MIN_RUN_DURATION_S, so use the engine's limits, not the app's older copy.
    if (run.distance * 1000 < ENGINE.MIN_MEANINGFUL_RUN_DISTANCE_M || run.elapsed < ENGINE.MIN_RUN_DURATION_S) {
      Alert.alert(`End ${sport.verb}?`, "You haven't gone far enough to save it. End anyway?", [
        { text: 'Keep going', style: 'cancel' },
        { text: `End ${sport.verb}`, style: 'destructive', onPress: doFinish },
      ]);
      return;
    }
    setShowConfirm(true);
  }, [run.distance, run.elapsed, doFinish]);

  // L4: the Apple Watch companion mirrors the run and controls it.
  const [finishedRun, setFinishedRun] = useState(false);
  useWatchCompanion({
    isRunning: run.isRunning, isPaused: run.isPaused, finished: finishedRun,
    distanceKm: run.distance, elapsed: run.elapsed, pace: run.pace, unit: distanceUnit, metric: sport.metric,
    liveAreaM2: run.isRunning ? liveAreaM2 : undefined,
    onCommand: c => {
      if (c === 'start' && !run.isRunning && countdown == null) handleStartPress();
      else if (c === 'pause' && run.isRunning && !run.isPaused) run.pauseRun();
      else if (c === 'resume' && run.isPaused) run.resumeRun();
      // End is only offered on the watch while paused: a deliberate second tap.
      else if (c === 'end' && run.isRunning) { setFinishedRun(true); doFinish(); }
    },
  });

  const handleBack = useCallback(() => {
    if (!run.isRunning) { nav.goBack(); return; }
    Alert.alert(`Discard this ${sport.verb}?`, `Your ${sport.verb} so far will be lost.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => {
        // Remove the crash-recovery checkpoint so the user isn't prompted to
        // restore a cancelled run on next app launch.
        const cpKey = `${run.gpsCheckpointPrefix}${run.activeRunId}`;
        AsyncStorage.removeItem(cpKey).catch(() => {});
        allowLeaveRef.current = true;
        nav.goBack();
      }},
    ]);
  }, [run.isRunning, run.activeRunId, run.gpsCheckpointPrefix, nav, sport.verb]);

  useEffect(() => nav.addListener('beforeRemove', e => {
    if (allowLeaveRef.current || !runningRef.current) return;
    e.preventDefault();
    handleBack();
  }), [nav, handleBack]);

  const stateLabel = !run.isRunning ? 'Ready' : run.isPaused ? 'Paused' : sport.gerund;

  // ── Lap (each whole km/mi) and its pace ─────────────────────────────────────
  const unitKm = distanceUnit === 'mi' ? 1.609344 : 1;
  const unitDist = run.distance / unitKm;
  const lapIdx = Math.floor(unitDist);
  if (lapIdx !== lapStartRef.current.idx) {
    lapStartRef.current = { idx: lapIdx, elapsed: run.elapsed, dist: lapIdx };
  }
  const lapCovered = unitDist - lapStartRef.current.dist;
  const lapSecs = run.elapsed - lapStartRef.current.elapsed;
  const lap = run.isRunning && unitDist >= 1 && lapCovered > 0.05
    ? { n: lapIdx + 1, pace: sport.metric === 'speed' ? `${(lapCovered / Math.max(1, lapSecs) * 3600).toFixed(1)}` : fmtPaceSecs(lapSecs / lapCovered) }
    : null;

  // ── Close the loop: distance back to the start, once the run can claim ─────
  const pts = run.gpsPoints;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const toStartM = first && last ? haversineM(last, first) : 0;
  if (toStartM > farthestRef.current) farthestRef.current = toStartM;
  const loopRow: { label: string; detail: string; pct: number } | null = !sport.claims || !run.isRunning || pts.length < 2 ? null
    : run.distance * 1000 < ENGINE.MIN_TERRITORY_DIST_M
      ? {
          label: 'Run 200 m to start claiming',
          detail: `${Math.max(0, Math.round(ENGINE.MIN_TERRITORY_DIST_M - run.distance * 1000))} m to go`,
          pct: (run.distance * 1000) / ENGINE.MIN_TERRITORY_DIST_M,
        }
      : loopClosing
        ? { label: 'Loop closed', detail: liveAreaM2 > 0 ? `${fmtArea(liveAreaM2)} on finish` : 'The ground inside is yours on finish', pct: 1 }
        : {
            label: 'Close the loop to claim',
            detail: `${toStartM >= 1000 ? `${(toStartM / 1000).toFixed(1)} km` : `${Math.round(toStartM)} m`} to go${liveAreaM2 > 0 ? ` · ${fmtArea(liveAreaM2)}` : ''}`,
            pct: farthestRef.current > 0 ? 1 - toStartM / farthestRef.current : 0,
          };

  // ── Live sharing + nearest friend ──────────────────────────────────────────
  const nearestFriend = useMemo(() => {
    if (!last || liveFriends.length === 0) return null;
    return liveFriends
      .map(f => ({ f, m: haversineM(last, { lat: f.lat, lng: f.lng }) }))
      .sort((a, b) => a.m - b.m)[0];
  }, [liveFriends, last?.lat, last?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // One banner at a time, most urgent first. Colour follows what it's about:
  // your loop is your zone colour, a rival is rival blue.
  const banner: { text: string; tone: 'own' | 'rival' | 'warn' | 'good' } | null =
    !run.isRunning ? null
    : speedWarning ? { text: sport.claims ? "Too fast. This stretch won't earn territory" : "Too fast for a ride. This stretch won't count", tone: 'warn' }
    : loopClosing ? { text: 'Loop closing. Keep going to fill the zone', tone: 'own' }
    : nearRival ? { text: 'Rival territory ahead', tone: 'rival' }
    : isOffRoute ? { text: 'Off route. Head back to the dashed line', tone: 'warn' }
    : isNearRouteEnd ? { text: `Almost there. ${Math.round(routeProgress!.distanceRemainingM)} m to go`, tone: 'good' }
    : null;
  // Voice coach (L1): km splits, loop, banners, workout steps, target zone.
  const lastPt = run.gpsPoints.length ? run.gpsPoints[run.gpsPoints.length - 1] : null;
  const targetZone = route.params?.targetZone;
  useVoiceCues({
    running: run.isRunning && !run.isPaused,
    ride: activityType === 'cycle',
    distanceKm: run.distance,
    elapsedSec: run.elapsed,
    toStartM: loopRow && !loopClosing ? toStartM : null,
    farthestM: farthestRef.current,
    banner: banner && !banner.text.startsWith('Loop closing') ? banner.text : null,
    workout,
    targetInside: targetZone && lastPt ? targetProgress(lastPt, targetZone).inside : null,
  });

  // Lock screen / Dynamic Island (L2): started with the run, ended when this screen goes.
  const liveProps: RunActivityProps = {
    sport: sport.label,
    distance: unitDist.toFixed(2),
    unit: distanceUnit,
    time: fmtTime(Math.round(run.elapsed)),
    // run.pace is always per km and the speed below is km/h: convert both to the
    // runner's unit, or "/mi" and "mph" sit next to kilometre numbers.
    pace: activityType === 'cycle'
      ? `${run.elapsed > 0 ? ((run.distance / run.elapsed) * 3600 / unitKm).toFixed(1) : '0.0'} ${distanceUnit === 'mi' ? 'mph' : 'km/h'}`
      : `${convertPaceStringPerKm(run.pace, distanceUnit)} /${distanceUnit}`,
    status: run.isPaused ? 'Paused'
      : workout && !workout.progress.done ? workout.progress.step.label
      : loopClosing ? 'Loop closing'
      : 'Recording',
  };
  useEffect(() => {
    if (run.isRunning) void startRunActivity(liveProps);
  }, [run.isRunning]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (run.isRunning) updateRunActivity(liveProps, run.isPaused);
  }); // every render; throttled inside
  useEffect(() => () => { void endRunActivity(); void endSafetyShare(); }, []);

  // Safety link: positions every 15 s while it's on.
  const [safetyOn, setSafetyOn] = useState(isSharing());
  const sendSafetyLink = async () => {
    try {
      await startAndSendSafetyShare(run.activeRunId ?? `run-${Date.now()}`, activityType, sport.verb);
      setSafetyOn(true);
      if (lastPt) pushSafetyPosition(lastPt, run.distance * 1000, run.elapsed, true);
    } catch {
      Alert.alert("Couldn't create the link", 'Check your connection and try again.');
    }
  };
  useEffect(() => {
    if (safetyOn && lastPt && run.isRunning) pushSafetyPosition(lastPt, run.distance * 1000, run.elapsed);
  });

  const bannerColor = banner?.tone === 'own' ? zone.own
    : banner?.tone === 'rival' ? zone.rival
    : banner?.tone === 'good' ? C.green
    : zone.ownFading;

  return (
    <View style={ss.root}>
      <View style={ss.map}>
        <ActiveRunMapView gpsPoints={run.gpsPoints} isRunning={run.isRunning} ghostRoutePoints={ghostRoutePoints} closestIdx={routeProgress?.closestIdx ?? 0} mapStyle={mapStyle} liveFriends={friendsShown ? liveFriends : []} ownZones={mapZones.own} rivalZones={mapZones.rivals} />

        <View style={[ss.topBar, { top: insets.top + 8 }]}>
          <Pressable onPress={handleBack} style={ss.iconPill} hitSlop={12} accessibilityLabel={run.isRunning ? 'Cancel run' : 'Close'}>
            <X size={16} color={C.t1} weight="bold" />
          </Pressable>
          {run.isRunning && sharingLive && run.gpsLocked ? (
            <View style={ss.pill}>
              <View style={[ss.pillDot, { backgroundColor: C.green }]} />
              <Text style={ss.pillTxt}>Sharing live</Text>
            </View>
          ) : run.isRunning ? (
            <View style={ss.pill}>
              <View style={[ss.pillDot, { backgroundColor: run.gpsLocked ? C.green : C.amber }]} />
              <Text style={ss.pillTxt}>{run.gpsLocked ? 'GPS locked' : 'Finding GPS'}</Text>
            </View>
          ) : (
            <View style={ss.pill}><Text style={ss.pillTxt}>Ready to {sport.verb}</Text></View>
          )}
          {nearestFriend && friendsShown ? (
            <Pressable
              style={ss.pill} hitSlop={6}
              onPress={() => setCheerFor({ userId: nearestFriend.f.userId, username: nearestFriend.f.username, avatarColor: nearestFriend.f.avatarColor })}
              accessibilityRole="button" accessibilityLabel={`Cheer ${nearestFriend.f.username}`}
            >
              <View style={[ss.friendDot, { backgroundColor: nearestFriend.f.avatarColor }]}>
                <Text style={ss.friendInitial}>{(nearestFriend.f.username[0] ?? '?').toUpperCase()}</Text>
              </View>
              <Text style={ss.pillTxt} numberOfLines={1}>
                {nearestFriend.f.username} · {nearestFriend.m >= 1000 ? `${(nearestFriend.m / 1000).toFixed(1)} km` : `${Math.round(nearestFriend.m)} m`}
              </Text>
              <Text style={ss.pillTxt}>👏</Text>
            </Pressable>
          ) : run.isRunning ? (
            <BeatPacerChip bpm={pacer.bpm} enabled={pacer.enabled} onToggle={() => pacer.setEnabled(!pacer.enabled)} />
          ) : <View style={{ width: 36 }} />}
        </View>

        {/* Safety link (R2): share your live position with anyone, no app needed. */}
        {run.isRunning && (
          <Pressable hitSlop={8}
            style={[ss.pill, ss.safetyPill, { top: insets.top + 54 }, safetyOn && { backgroundColor: C.green }]}
            onPress={sendSafetyLink}
            accessibilityRole="button"
            accessibilityLabel={safetyOn ? 'Safety link on. Send it again' : 'Share a live safety link'}
          >
            <ShieldCheck size={14} color={safetyOn ? C.alwaysLight : C.t1} weight={safetyOn ? 'fill' : 'bold'} />
            <Text style={[ss.pillTxt, safetyOn && { color: C.alwaysLight }]}>{safetyOn ? 'Safety link on' : 'Safety link'}</Text>
          </Pressable>
        )}

        {cheers.current && (
          <CheerToast
            cheer={cheers.current} runnerName={run.player?.username ?? ''} extra={Math.max(0, cheers.count - 1)}
            top={insets.top + 100} onThank={cheers.thank} onMute={cheers.mute} onDismiss={cheers.dismiss}
          />
        )}

        {run.isRunning && !run.gpsLocked && (
          <View style={ss.gpsAcquiring}>
            <ActivityIndicator size="small" color={C.red} />
            <Text style={ss.gpsAcquiringText}>Finding GPS…</Text>
            <Text style={ss.gpsAcquiringSub}>Step outside for a better signal</Text>
          </View>
        )}

        <View style={ss.bannerStack} pointerEvents="box-none">
          {run.gpsError && (
            // Tappable: a permission/location-services problem is fixed in Settings, so
            // say so and take them there instead of showing a dead-end message.
            <Pressable
              style={ss.banner}
              onPress={() => { Linking.openSettings().catch(() => {}); }}
              accessibilityRole="button"
              accessibilityHint="Opens Settings"
            >
              <Text style={ss.bannerTxt}>{run.gpsError}{'\n'}Tap to open Settings</Text>
            </Pressable>
          )}
          {banner && (
            <View style={ss.banner}>
              <View style={[ss.bannerDot, { backgroundColor: bannerColor, alignItems: 'center', justifyContent: 'center' }]}><Hexagon size={14} color={C.alwaysDark} weight="bold" /></View>
              <Text style={ss.bannerTxt}>{banner.text}</Text>
            </View>
          )}
        </View>
      </View>

      {/* One-shot capture reward, center-screen, self-dismissing */}
      <ClaimToast event={claimEvent} onDismiss={() => setClaimEvent(null)} />

      {countdown !== null && (
        <CountdownOverlay
          seconds={countdown}
          onComplete={() => {
            setCountdown(null);
            feedback.runStart();
            run.startRun();
          }}
        />
      )}

      <View style={[ss.sheet, { paddingBottom: insets.bottom + 14 }]}>
        <View style={ss.grab} />
        {coach.show && !route.params?.targetZone && <LoopCoachCard onDismiss={coach.dismiss} />}
        {route.params?.targetZone && (
          <TargetZoneChip
            zone={route.params.targetZone}
            position={run.gpsPoints.length ? run.gpsPoints[run.gpsPoints.length - 1] : null}
            running={run.isRunning && !run.isPaused}
          />
        )}
        {workout && run.isRunning && <WorkoutPanel view={workout} />}
        <RunHUD
          distance={run.distance}
          pace={run.pace}
          elapsed={run.elapsed}
          liveAreaM2={run.isRunning ? liveAreaM2 : undefined}
          metric={sport.metric}
          showZone={sport.claims}
          unit={distanceUnit}
          stateLabel={stateLabel}
          lap={lap}
          gpsPoints={run.gpsPoints}
          elevationGainM={run.elevationGainM}
        />

        {loopRow && (
          <View style={ss.loopRow}>
            <View style={ss.loopHead}>
              <Text style={ss.loopLabel}>{loopRow.label}</Text>
              <Text style={ss.loopDetail}><Text style={{ color: zone.own, fontFamily: Fonts.bold }}>{loopRow.detail.split(' · ')[0]}</Text>{loopRow.detail.includes(' · ') ? ` · ${loopRow.detail.split(' · ').slice(1).join(' · ')}` : ''}</Text>
            </View>
            <View style={ss.loopTrack}>
              <View style={[ss.loopFill, { width: `${Math.round(Math.min(1, Math.max(0, loopRow.pct)) * 100)}%`, backgroundColor: zone.own }]} />
            </View>
          </View>
        )}

        {ghostRoutePoints && routeProgress && run.isRunning && (
          <View style={ss.metaRow}>
            <Text style={ss.metaTxt}>
              {routeProgress.distanceRemainingM >= 1000
                ? `${fmtDistShort(routeProgress.distanceRemainingM)} km left on route`
                : `${Math.round(routeProgress.distanceRemainingM)} m left on route`}
            </Text>
          </View>
        )}

        <View style={ss.controls}>
          {!run.isRunning
            ? (
              <Pressable style={({ pressed }) => [ss.startBtn, pressed && { opacity: 0.9 }]} onPress={handleStartPress} accessibilityRole="button" accessibilityLabel={`Start ${sport.verb}`}>
                <Play size={20} color={C.lime} weight="fill" />
                <Text style={ss.startTxt}>Start {sport.verb}</Text>
              </Pressable>
            )
            : !run.isPaused
              ? <RunControls
                  isPaused={false} onPause={run.pauseRun} onResume={run.resumeRun} onStop={handleFinish}
                  onFriends={liveFriends.length > 0 ? () => setFriendsShown(v => !v) : undefined}
                  friendsShown={friendsShown}
                />
              : <View style={{ height: 60 }} />
          }
        </View>
      </View>

      {/* Pause overlay — dims and absorbs touches only. It must NOT resume on tap: a
          pocket/palm/rain touch would restart the run. Resume is the explicit button below. */}
      {run.isPaused && <View style={ss.pauseOverlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}

      {/* Pause card */}
      <Animated.View
        style={[ss.pauseCard, { paddingBottom: insets.bottom + 16 }, pauseCardStyle]}
        pointerEvents={run.isPaused ? 'auto' : 'none'}
        accessibilityElementsHidden={!run.isPaused}
        importantForAccessibility={run.isPaused ? 'auto' : 'no-hide-descendants'}
      >
        <View style={ss.pauseHandle} />
        <Text style={ss.pauseTitle}>Paused</Text>
        <Text style={ss.pauseTime}>{fmtTime(run.elapsed)}</Text>
        <View style={ss.pauseStats}>
          <View style={ss.pauseStat}>
            <Text style={ss.pauseStatVal}>{convertKm(run.distance, distanceUnit).toFixed(2)}</Text>
            <Text style={ss.pauseStatLbl}>{distanceUnit}</Text>
          </View>
          <View style={ss.pauseStatDivider} />
          <View style={ss.pauseStat}>
            <Text style={ss.pauseStatVal}>{convertPaceStringPerKm(run.pace, distanceUnit)}</Text>
            <Text style={ss.pauseStatLbl}>Avg pace /{distanceUnit}</Text>
          </View>
        </View>
        <Pressable style={ss.resumeBtn} onPress={run.resumeRun} accessibilityRole="button" accessibilityLabel="Resume">
          <Play size={16} color={C.bg} weight="fill" />
          <Text style={ss.resumeBtnTxt}>Resume</Text>
        </Pressable>
        <Pressable style={ss.pauseFinishBtn} onPress={handleFinish} accessibilityRole="button" accessibilityLabel="Finish run">
          <View style={ss.finishSquare} />
          <Text style={ss.pauseFinishBtnTxt}>Finish run</Text>
        </Pressable>
      </Animated.View>

      {showConfirm && (
        <FinishConfirmSheet
          distance={run.distance}
          elapsed={run.elapsed}
          verb={sport.verb}
          bottomInset={insets.bottom}
          unit={distanceUnit}
          onKeepRunning={() => setShowConfirm(false)}
          onFinish={doFinish}
        />
      )}
      <CheerSheet target={cheerFor} onClose={() => setCheerFor(null)} />
    </View>
  );
}

function mkStyles(C: AppColors) {
  const floating = {
    backgroundColor: C.card, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  } as const;
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    map:         { flex: 1, overflow: 'hidden' },
    topBar:      { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconPill:    { ...floating, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    safetyPill:   { position: 'absolute', right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
    pill:        { ...floating, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30 },
    pillDot:     { width: 7, height: 7, borderRadius: 4 },
    pillTxt:     { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    gpsAcquiring:     { position: 'absolute', top: '35%', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: C.card, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 14, elevation: 6 },
    gpsAcquiringText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    gpsAcquiringSub:  { ...Type.caption, color: C.t2 },
    bannerStack: { position: 'absolute', left: 16, right: 16, bottom: 28, gap: 8 },
    banner:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.alwaysDark, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
    bannerDot:   { width: 28, height: 28, borderRadius: 14 },
    bannerTxt:   { fontFamily: Fonts.regular, fontSize: 14, color: C.alwaysLight, flex: 1 },
    sheet:       { backgroundColor: C.card, borderTopLeftRadius: 34, borderTopRightRadius: 34, marginTop: -24, paddingTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 },
    grab:        { width: 38, height: 5, borderRadius: 5, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
    friendDot:   { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
    friendInitial: { fontFamily: Fonts.bold, fontSize: 10, color: '#fff' },
    loopRow:     { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 18, backgroundColor: C.mint },
    loopHead:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    loopLabel:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    loopDetail:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, fontVariant: ['tabular-nums'] },
    loopTrack:   { height: 8, borderRadius: 4, backgroundColor: C.mint2, overflow: 'hidden', marginTop: 8 },
    loopFill:    { height: 8, borderRadius: 9 },
    metaRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
    metaTxt:     { ...Type.caption, color: C.t2 },
    controls:    { paddingHorizontal: 20, paddingTop: 16 },
    startBtn:    { height: 60, borderRadius: 30, backgroundColor: C.alwaysDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    startTxt:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.alwaysLight },
    // Pause card
    pauseOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
    pauseCard:         { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, zIndex: 11, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
    pauseHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 18 },
    pauseTitle:        { ...Type.overline, color: C.t2, textAlign: 'center', marginBottom: 4 },
    pauseTime:         { fontFamily: Fonts.numeric, fontSize: 72, color: C.t1, textAlign: 'center', letterSpacing: -1, lineHeight: 72, marginBottom: 14, fontVariant: ['tabular-nums'] },
    pauseStats:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 22 },
    pauseStat:         { alignItems: 'center', gap: 2 },
    pauseStatVal:      { fontFamily: Fonts.numeric, fontSize: 30, color: C.t1, fontVariant: ['tabular-nums'] },
    pauseStatLbl:      { ...Type.caption, color: C.t2 },
    pauseStatDivider:  { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: C.border },
    resumeBtn:         { backgroundColor: C.t1, borderRadius: 30, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
    resumeBtnTxt:      { fontFamily: Fonts.semiBold, fontSize: 16, color: C.bg },
    pauseFinishBtn:    { height: 52, borderRadius: 26, backgroundColor: C.redLo, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    finishSquare:      { width: 12, height: 12, borderRadius: 3, backgroundColor: C.red },
    pauseFinishBtnTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.red },
  });
}
