/**
 * Native version of useActiveRun — replaces browser geolocation with
 * expo-location and WakeLock with expo-keep-awake.
 * Integrates with the background location task for screen-off tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedback } from '@theme';
import { track } from '@shared/services/analytics';
import { useGameEngine } from '@shared/hooks/useGameEngine';
import { GAME_CONFIG } from '@shared/services/config';
import { formatPace } from '@shared/lib/paceFormat';
import { getSettings } from '@shared/services/store';
import { upsertLivePosition, clearLivePosition } from '@shared/services/liveRunSharing';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  drainBgGpsBuffer,
  clearBgGpsBuffer,
  bufferedActiveRun,
  GPS_CHECKPOINT_PREFIX,
} from '../services/locationTask';
import { freshScreenOffFixes } from '../services/screenOffMerge';
import { checkpointWrites, readCheckpoint, isPartKey, partKey } from '../services/runCheckpoint';
import { addFixes, MAX_FOOT_SPEED_MS, MAX_RIDE_SPEED_MS, type Fix } from '../services/gpsFilter';
import { isOnFoot } from '@shared/engine/runEngine';

const GPS_CHECKPOINT_INTERVAL_MS = 30_000;
// How often a running position reaches friends — not every GPS tick (~1/sec):
// battery/bandwidth, and a friend's marker only needs to look alive, not
// exactly track every single fix.
const LIVE_SHARE_INTERVAL_MS = 6_000;
const GPS_LOCK_REQUIRED_POINTS = 3;
// No accepted fix for this long while running = signal lost (drop the "GPS locked" state).
const GPS_STALE_MS = 10_000;
// Below ~1.8 km/h counts as stopped (well under walking pace, so normal running/
// walking cadence never trips it); 8s of that before auto-pausing absorbs a red
// light or a photo stop without pausing on every brief slowdown.
const AUTO_PAUSE_SPEED_MS = 0.5;
const AUTO_PAUSE_DELAY_MS = 8_000;

// 'standard' still needs to be good enough for territory-corridor accuracy —
// this is one step down from BestForNavigation, not a big drop to Balanced/Low,
// since claimed-zone geometry and the PACE economy both depend on this track.
// Same split as the server: every territory sport is on foot, everything else rides.
const maxSpeedFor = (activityType: string) => (isOnFoot(activityType) ? MAX_FOOT_SPEED_MS : MAX_RIDE_SPEED_MS);

function resolveGpsAccuracy(setting: 'standard' | 'high'): Location.Accuracy {
  return setting === 'standard' ? Location.Accuracy.High : Location.Accuracy.BestForNavigation;
}

/**
 * Returns the run an interrupted session left behind (crash recovery): its
 * checkpoint, or, when there is none, the background buffer alone. On Android
 * a run recorded with the screen off has no live points (so no checkpoint
 * parts); the buffer is the whole run.
 */
export async function findInterruptedRunCheckpoint(): Promise<{ runId: string; startTime: number; points: GPSPoint[]; activityType: string; mocked: boolean } | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const checkpointKey = keys.find(k => k.startsWith(GPS_CHECKPOINT_PREFIX) && !isPartKey(k));
    const raw = checkpointKey ? await AsyncStorage.getItem(checkpointKey) : null;
    if (checkpointKey && raw) {
      const cp = await readCheckpoint(raw, n => AsyncStorage.getItem(partKey(checkpointKey, n)));
      const runId = checkpointKey.slice(GPS_CHECKPOINT_PREFIX.length);
      return { runId, ...cp };
    }
    const buffered = bufferedActiveRun();
    if (!buffered) return null;
    return { runId: buffered.runId, startTime: buffered.firstTs, points: [], activityType: 'run', mocked: false };
  } catch {
    return null;
  }
}

/** Discard any lingering checkpoint (called when user dismisses recovery). */
export async function clearInterruptedRunCheckpoint(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const checkpointKeys = keys.filter(k => k.startsWith(GPS_CHECKPOINT_PREFIX));
    if (checkpointKeys.length > 0) await AsyncStorage.multiRemove(checkpointKeys);
  } catch { /* ignore */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
  accuracy: number;
  altitude: number;
}

interface ActiveRunState {
  isRunning: boolean;
  isPaused: boolean;
  elapsed: number;
  distance: number;
  pace: string;
  currentSpeed: number;
  gpsPoints: GPSPoint[];
  gpsError: string | null;
}


// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useActiveRun(activityType: string = 'run') {
  const gameEngine = useGameEngine();

  const [state, setState] = useState<ActiveRunState>({
    isRunning:    false,
    isPaused:     false,
    elapsed:      0,
    distance:     0,
    pace:         '0:00',
    currentSpeed: 0,
    gpsPoints:    [],
    gpsError:     null,
  });
  const [gpsLocked, setGpsLocked] = useState(false);
  // Screen-off tracking isn't running (background permission refused, or the
  // task failed to start): the runner is told to keep the app open.
  const [backgroundWarning, setBackgroundWarning] = useState<string | null>(null);

  const locationSubRef      = useRef<Location.LocationSubscription | null>(null);
  const appStateSubRef      = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkpointIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef        = useRef<number>(0);
  const pauseStartRef     = useRef<number>(0);
  const totalPausedMsRef  = useRef<number>(0);
  // Distance filter state (gpsFilter): the last fix distance is measured from,
  // and how many impossible jumps in a row have been seen.
  const filterRef         = useRef<{ base: Fix | null; outliers: number }>({ base: null, outliers: 0 });
  const runIdRef          = useRef<string>('');
  const lastGpsStateUpdateRef = useRef<number>(0);
  const gpsPointsRef      = useRef<GPSPoint[]>([]);
  const pendingDistanceRef = useRef<number>(0);
  const totalDistanceRef  = useRef<number>(0);
  const isFinishingRef    = useRef<boolean>(false);
  const isStartingRef     = useRef<boolean>(false);
  const appStateRef       = useRef<AppStateStatus>(AppState.currentState);
  // Refs that mirror state for use inside callbacks/finishRun — avoids stale closures
  const elapsedRef        = useRef<number>(0);
  const paceRef           = useRef<string>('0:00');
  // isPausedRef mirrors isPaused state for use inside GPS callback (avoids stale closure)
  const isPausedRef            = useRef<boolean>(false);
  // gpsLockedRef + consecutiveGoodPointsRef: prevents distance accumulation from iOS stale cache
  const gpsLockedRef           = useRef<boolean>(false);
  // Time of the last fix that passed the accuracy gate while locked. If it goes stale
  // (tunnel, dense buildings) the lock is dropped so the UI stops claiming "GPS locked"
  // while distance and pace are frozen.
  const lastGoodFixAtRef       = useRef<number>(0);
  const consecutiveGoodPointsRef = useRef(0);
  // Android reports `mocked` on each fix when a mock-location provider supplied
  // it. One such fix flags the whole run: it is sent to the server, which pays
  // and claims nothing for it (security audit H1).
  const mockedLocationRef = useRef(false);
  const prevAltitudeRef        = useRef<number | null>(null);
  const elevationGainRef       = useRef<number>(0);
  const lastKmRef              = useRef<number>(0);
  // Auto-pause: distinguishes a user-tapped pause (isPausedRef alone) from one
  // this hook triggered itself, so auto-pause never fights a deliberate pause,
  // and only a stop *it* caused gets auto-resumed on movement.
  const autoPauseEnabledRef    = useRef<boolean>(false);
  const manualPauseRef         = useRef<boolean>(false);
  const autoPausedRef          = useRef<boolean>(false);
  const stoppedSinceRef        = useRef<number | null>(null);
  // Time of the last fix that showed movement. iOS sends no fixes at all while
  // standing still (distanceInterval), so auto-pause is also checked from the
  // 1 s timer, not only from fix callbacks.
  const lastMovingFixAtRef     = useRef<number>(0);
  // Only phones that report speed can auto-resume, so only they auto-pause from the timer.
  const speedKnownRef          = useRef<boolean>(false);
  // Live Run Sharing — read once at run start (matches autoPauseEnabledRef's
  // pattern); playerIdRef stays fresh via the effect below so the GPS watcher
  // closure (created once per startRun call) never reads a stale id.
  const liveSharingEnabledRef  = useRef<boolean>(false);
  const lastLiveBroadcastRef   = useRef<number>(0);
  const playerIdRef            = useRef<string | null>(null);

  useEffect(() => { playerIdRef.current = gameEngine.player?.id ?? null; }, [gameEngine.player?.id]);


  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      locationSubRef.current?.remove();
      appStateSubRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
      if (checkpointIntervalRef.current) clearInterval(checkpointIntervalRef.current);
      deactivateKeepAwake();
      stopBackgroundTracking().catch(() => {});
      clearBgGpsBuffer(runIdRef.current);
      if (liveSharingEnabledRef.current && playerIdRef.current) {
        clearLivePosition(playerIdRef.current).catch(() => {});
      }
    };
  }, []);

  // ── Merging screen-off points ──────────────────────────────────────────────
  // On iOS the live watcher keeps receiving fixes while the screen is locked
  // (the background task keeps the app alive), and the background task buffers
  // the same fixes. Merging the whole buffer counted every screen-off stretch
  // twice: distance, pace, PACE and the trace. Only fixes newer than the last
  // one the live watcher recorded are new; on Android, where the watcher stops
  // in the background, that's all of them.
  const mergeBgPoints = useCallback((bgPoints: ReturnType<typeof drainBgGpsBuffer>): boolean => {
    const pts = gpsPointsRef.current;
    const fresh = freshScreenOffFixes(pts.length ? pts[pts.length - 1].timestamp : 0, bgPoints);
    if (fresh.some(p => p.mocked)) mockedLocationRef.current = true;
    const r = addFixes(filterRef.current, fresh, maxSpeedFor(activityType));
    filterRef.current = { base: r.base, outliers: r.outliers };
    totalDistanceRef.current += r.addedM / 1000;
    for (const pt of r.kept) {
      gpsPointsRef.current.push({ lat: pt.lat, lng: pt.lng, timestamp: pt.timestamp, speed: pt.speed, accuracy: pt.accuracy, altitude: 0 });
    }
    return r.kept.length > 0;
  }, [activityType]);

  // ── Start ───────────────────────────────────────────────────────────────────
  const startRun = useCallback(async () => {
    // Re-entrancy guard: a double-tap on the start button before the first await
    // resolves would otherwise create two GPS watchers and two timers, overwriting
    // locationSubRef/timerRef and leaking the first (duplicate points, distance
    // inflation, and a subscription that's never cleaned up).
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    // Request foreground permission
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setState(prev => ({ ...prev, gpsError: 'Permission denied — enable location in Settings' }));
      isStartingRef.current = false;
      return;
    }

    // iOS tracks with the screen locked on "While Using" (background mode + the blue
    // indicator), so it never asks for "Always". Android needs background location
    // for that; if refused, foreground tracking still works and the runner is told.
    if (Platform.OS === 'android') {
      const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
      setBackgroundWarning(bg?.status === 'granted' ? null
        : "Screen-off tracking is off. Keep Runivo open, or allow location 'All the time' in Settings.");
    } else {
      setBackgroundWarning(null);
    }

    const settings = await getSettings().catch(() => null);
    const gpsAccuracy = resolveGpsAccuracy(settings?.gpsAccuracy ?? 'high');
    autoPauseEnabledRef.current = settings?.autoPause ?? false;
    liveSharingEnabledRef.current = settings?.liveRunSharingEnabled ?? false;
    lastLiveBroadcastRef.current = 0;
    manualPauseRef.current = false;
    autoPausedRef.current = false;
    stoppedSinceRef.current = null;
    lastMovingFixAtRef.current = Date.now();

    // Keeping the screen awake is a nicety; failing to get it must not stop the run starting.
    await activateKeepAwakeAsync().catch(() => {});

    // CRITICAL PATH (useActiveRun): fire-and-forget funnel event, no GPS/lat-lng in
    // properties — track() never throws, so this can't affect the run starting below.
    track('run_started', { activityType });

    // App state handler: re-acquire keep-awake on foreground resume + drain bg buffer.
    // Stored in ref so it can be removed on finish/unmount without leaking.
    appStateSubRef.current?.remove();
    appStateSubRef.current = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        await activateKeepAwakeAsync();
        // Drain GPS points collected while screen was off.
        // CRITICAL PATH: skip the whole drain while paused — pause can only be toggled
        // from the foreground UI, so a true isPausedRef here means the entire buffered
        // background window was during a paused run. Counting it would inflate distance
        // while paused (the live GPS callback already returns early when paused at :254).
        const bgPoints = drainBgGpsBuffer(runIdRef.current);
        if (bgPoints.length > 0 && !isPausedRef.current && mergeBgPoints(bgPoints)) {
          // The live state's distance lags totalDistanceRef by whatever is pending.
          pendingDistanceRef.current = 0;
          setState(prev => ({
            ...prev,
            distance: Math.round(totalDistanceRef.current * 1000) / 1000,
            gpsPoints: [...gpsPointsRef.current],
          }));
        }
      }
      appStateRef.current = nextState;
    });

    startTimeRef.current     = Date.now();
    pauseStartRef.current    = 0;
    totalPausedMsRef.current = 0;
    filterRef.current        = { base: null, outliers: 0 };
    runIdRef.current         = crypto.randomUUID();
    mockedLocationRef.current = false;
    gpsPointsRef.current     = [];
    pendingDistanceRef.current = 0;
    totalDistanceRef.current   = 0;
    isFinishingRef.current          = false;
    isPausedRef.current             = false;
    gpsLockedRef.current            = false;
    consecutiveGoodPointsRef.current = 0;
    prevAltitudeRef.current         = null;
    elevationGainRef.current        = 0;
    setGpsLocked(false);

    // Periodic GPS checkpoint: persists in-memory GPS points to AsyncStorage every 30s
    // so a crash/force-kill doesn't lose the entire run trace.
    const cpKey = `${GPS_CHECKPOINT_PREFIX}${runIdRef.current}`;
    if (checkpointIntervalRef.current) clearInterval(checkpointIntervalRef.current);
    // Compact parts, and only the parts that changed (runCheckpoint.ts, audit P1-14).
    let savedFullParts = 0;
    // The meta row is written now, before any live point: with the screen off
    // straight away (Android) there may never be one, and recovery must still
    // find the run (its points are in the background buffer).
    AsyncStorage.multiSet(checkpointWrites(cpKey, startTimeRef.current, activityType, [], 0).rows).catch(() => {});
    checkpointIntervalRef.current = setInterval(async () => {
      if (gpsPointsRef.current.length === 0) return;
      const w = checkpointWrites(cpKey, startTimeRef.current, activityType, gpsPointsRef.current, savedFullParts, mockedLocationRef.current);
      try {
        await AsyncStorage.multiSet(w.rows);
        savedFullParts = w.fullParts;
      } catch { /* next tick tries again */ }
    }, GPS_CHECKPOINT_INTERVAL_MS);

    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused:  false,
      elapsed:   0,
      distance:  0,
      pace:      '0:00',
      gpsPoints: [],
      gpsError:  null,
    }));

    // 1-second timer
    timerRef.current = setInterval(() => {
      // Signal-loss watchdog: no accepted fix for GPS_STALE_MS while moving → unlock.
      // Re-locking needs GPS_LOCK_REQUIRED_POINTS good fixes again (existing gate).
      if (isPausedRef.current) lastGoodFixAtRef.current = Date.now();   // don't count paused time as signal loss
      if (
        gpsLockedRef.current && !isPausedRef.current &&
        Date.now() - lastGoodFixAtRef.current > GPS_STALE_MS
      ) {
        gpsLockedRef.current = false;
        consecutiveGoodPointsRef.current = 0;
        setGpsLocked(false);
      }
      // Auto-pause when no fix has shown movement for the delay (no fixes
      // arrive at all while standing still on iOS). The pause starts when the
      // runner stopped, so the stopped seconds don't count as moving time.
      if (
        autoPauseEnabledRef.current && !manualPauseRef.current && !isPausedRef.current && gpsLockedRef.current && speedKnownRef.current &&
        lastMovingFixAtRef.current > 0 && Date.now() - lastMovingFixAtRef.current >= AUTO_PAUSE_DELAY_MS
      ) {
        autoPausedRef.current = true;
        isPausedRef.current = true;
        pauseStartRef.current = stoppedSinceRef.current ?? lastMovingFixAtRef.current;
        setState(prev => ({ ...prev, isPaused: true }));
        feedback.runPause();
      }
      // Work out values outside the setState updater: React may run an updater
      // twice (Strict Mode), so updaters must not touch refs or play feedback (P1-13).
      if (isPausedRef.current) return;
      const totalElapsed = Math.floor(
        (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000,
      );
      elapsedRef.current = totalElapsed;
      setState(prev => (prev.isPaused ? prev : { ...prev, elapsed: totalElapsed }));
    }, 1000);

    // watchPositionAsync rejects when Location Services are off (or the
    // permission was revoked in between). By now `isRunning` is true and the
    // timers are ticking, and isStartingRef would stay set forever, so Start
    // silently did nothing until the app restarted. Undo the start instead.
    const abortStart = (err: unknown) => {
      console.warn('[useActiveRun] GPS watcher failed to start:', err);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (checkpointIntervalRef.current) { clearInterval(checkpointIntervalRef.current); checkpointIntervalRef.current = null; }
      appStateSubRef.current?.remove();
      appStateSubRef.current = null;
      deactivateKeepAwake();
      setState(prev => ({
        ...prev,
        isRunning: false,
        gpsError: "Couldn't start GPS. Check that Location Services are on, then try again.",
      }));
      isStartingRef.current = false;
    };

    // GPS watcher
    const watchSub = await Location.watchPositionAsync(
      {
        accuracy:     gpsAccuracy,
        timeInterval: 1000,
        distanceInterval: 3,
      },
      (location) => {
        const { latitude, longitude, speed, accuracy, altitude } = location.coords;
        // The fix's own time, the same clock the background buffer stores, so
        // the two can be lined up when merging (mergeBgPoints).
        const now = Math.round(location.timestamp || Date.now());   // iOS gives fractional ms
        // iOS reports speed = -1 (and some devices null) when a fix has no valid
        // speed. That is "unknown", not "standing still": reading it as 0 made
        // the auto-pause logic stop the run on any poor fix, and put a negative
        // speed in the trace.
        const speedKnown = typeof speed === 'number' && Number.isFinite(speed) && speed >= 0;
        const gpsSpeed = speedKnown ? (speed as number) : 0;
        if ((location as { mocked?: boolean }).mocked === true) mockedLocationRef.current = true;
        speedKnownRef.current = speedKnown;

        // Auto-pause / auto-resume — evaluated even while already paused, so a
        // stop this hook triggered can detect movement resuming. Never engages
        // if the user paused manually (manualPauseRef), and never overrides one.
        if (autoPauseEnabledRef.current && !manualPauseRef.current && speedKnown) {
          if (gpsSpeed < AUTO_PAUSE_SPEED_MS) {
            if (stoppedSinceRef.current == null) {
              stoppedSinceRef.current = now;
            } else if (!isPausedRef.current && now - stoppedSinceRef.current >= AUTO_PAUSE_DELAY_MS) {
              autoPausedRef.current = true;
              isPausedRef.current = true;
              pauseStartRef.current = stoppedSinceRef.current;
              setState(prev => ({ ...prev, isPaused: true }));
              feedback.runPause();
              if (liveSharingEnabledRef.current && playerIdRef.current) {
                clearLivePosition(playerIdRef.current).catch(() => {});
              }
            }
          } else {
            stoppedSinceRef.current = null;
            lastMovingFixAtRef.current = now;
            if (autoPausedRef.current) {
              autoPausedRef.current = false;
              totalPausedMsRef.current += now - pauseStartRef.current;
              filterRef.current = { base: null, outliers: 0 };
              isPausedRef.current = false;
              setState(prev => ({ ...prev, isPaused: false }));
              feedback.runStart();
            }
          }
        }

        // Skip GPS points while paused — prevents distance inflation
        if (isPausedRef.current) return;

        // Skip low-accuracy points — stricter than claimEngine's post-run filter
        // (GPS_ACCURACY_THRESHOLD_M, 50m) since a bad point here immediately
        // inflates the live distance/pace the user sees, with no smoothing pass
        // to absorb it.
        if ((accuracy ?? 100) > GAME_CONFIG.GPS_LIVE_ACCURACY_THRESHOLD_M) {
          consecutiveGoodPointsRef.current = 0;
          return;
        }

        // Require 3 consecutive accurate points before trusting GPS — prevents
        // iOS stale-cache snap (the "California bug") from inflating distance.
        consecutiveGoodPointsRef.current++;
        if (!gpsLockedRef.current && consecutiveGoodPointsRef.current >= GPS_LOCK_REQUIRED_POINTS) {
          gpsLockedRef.current = true;
          lastGoodFixAtRef.current = now;
          setGpsLocked(true);
        }
        if (!gpsLockedRef.current) return;
        lastGoodFixAtRef.current = now;

        if (!isFinite(latitude) || !isFinite(longitude)) return;
        // Distance through the same filter as screen-off fixes (gpsFilter):
        // spikes ignored, standing drift not counted, tunnel gaps kept.
        const step = addFixes(filterRef.current, [{ lat: latitude, lng: longitude, timestamp: now, accuracy: accuracy ?? 10 }], maxSpeedFor(activityType));
        filterRef.current = { base: step.base, outliers: step.outliers };
        if (step.kept.length === 0) return;   // an outlier: not distance, not trace
        const deltaKm = step.addedM / 1000;
        if (deltaKm > 0) {
          lastMovingFixAtRef.current = now;
          pendingDistanceRef.current += deltaKm;
          totalDistanceRef.current   += deltaKm;
        }

        // Accumulate elevation gain (>0.5m threshold filters out GPS altitude noise).
        // altitude is commonly null on the first fix or two (no 3D lock yet) — coercing
        // it to 0 used to record a fake "sea level" prior reading, so the first REAL
        // altitude (e.g. 40m) registered as a one-time +40m gain spike. Only track
        // deltas between two genuine altitude readings; skip (don't zero-fill) samples
        // where altitude is unavailable.
        if (altitude !== null && altitude !== undefined) {
          if (prevAltitudeRef.current !== null && altitude > prevAltitudeRef.current + 0.5) {
            elevationGainRef.current += altitude - prevAltitudeRef.current;
          }
          prevAltitudeRef.current = altitude;
        }

        gpsPointsRef.current.push({ lat: latitude, lng: longitude, timestamp: now, speed: gpsSpeed, accuracy: accuracy ?? 10, altitude: altitude ?? 0 });

        // Live Run Sharing — fire-and-forget, throttled independently of the 1s
        // state-update throttle below. Only reaches mutual connections who also
        // opted in (enforced server-side, see live_run_positions RLS) — this
        // client-side gate is just "don't even try" when the setting is off.
        if (liveSharingEnabledRef.current && playerIdRef.current && now - lastLiveBroadcastRef.current >= LIVE_SHARE_INTERVAL_MS) {
          lastLiveBroadcastRef.current = now;
          upsertLivePosition(playerIdRef.current, runIdRef.current, latitude, longitude, {
            startedAt: startTimeRef.current, distanceM: totalDistanceRef.current * 1000, elapsedSec: elapsedRef.current,
          }).catch(() => {});
        }

        // Throttle React state updates to max 1/sec
        if (now - lastGpsStateUpdateRef.current < 1000) return;
        lastGpsStateUpdateRef.current = now;

        // totalDistanceRef is the one running total (live fixes and merged
        // screen-off fixes alike); state just mirrors it. Feedback and ref writes
        // stay out of the updater (P1-13).
        pendingDistanceRef.current = 0;
        const newDistance = totalDistanceRef.current;
        const elapsedSec = elapsedRef.current > 0 ? elapsedRef.current : 1;
        const pace = formatPace(newDistance / elapsedSec);
        paceRef.current = pace;
        const currentKm = Math.floor(newDistance);
        if (currentKm > lastKmRef.current) {
          lastKmRef.current = currentKm;
          feedback.kmTick();
        }
        const pointsSnapshot = [...gpsPointsRef.current];
        setState(prev => (prev.isPaused ? prev : {
          ...prev,
          distance:     Math.round(newDistance * 1000) / 1000,
          pace,
          currentSpeed: gpsSpeed,
          gpsPoints:    pointsSnapshot,
        }));
      },
    ).catch((err: unknown) => { abortStart(err); return null; });
    if (!watchSub) return;
    locationSubRef.current = watchSub;

    // Start background location task for screen-off tracking
    startBackgroundTracking(runIdRef.current, gpsAccuracy).catch(err => {
      console.warn('[useActiveRun] background tracking unavailable:', err);
      setBackgroundWarning("Screen-off tracking couldn't start. Keep Runivo open until you finish.");
    });

    lastKmRef.current = 0;
    isStartingRef.current = false;
  }, [gameEngine, mergeBgPoints, activityType]);

  // ── Pause / Resume ──────────────────────────────────────────────────────────
  const pauseRun = useCallback(() => {
    manualPauseRef.current = true;
    autoPausedRef.current = false;
    isPausedRef.current = true;
    setState(prev => ({ ...prev, isPaused: true }));
    pauseStartRef.current = Date.now();
    feedback.runPause();
    if (liveSharingEnabledRef.current && playerIdRef.current) {
      clearLivePosition(playerIdRef.current).catch(() => {});
    }
  }, []);

  const resumeRun = useCallback(() => {
    totalPausedMsRef.current += Date.now() - pauseStartRef.current;
    // Reset last position so the first point after resume doesn't create a large delta
    filterRef.current = { base: null, outliers: 0 };
    manualPauseRef.current = false;
    stoppedSinceRef.current = null;
    lastMovingFixAtRef.current = Date.now();
    isPausedRef.current = false;
    setState(prev => ({ ...prev, isPaused: false }));
    feedback.runStart();
  }, []);

  // ── Finish ──────────────────────────────────────────────────────────────────
  // Reads all final values from refs (not state) to avoid stale-closure bugs.
  // Does NOT depend on `state` — avoids re-creating the callback on every state update.
  const finishRun = useCallback(async () => {
    if (isFinishingRef.current) return null;
    isFinishingRef.current = true;

    locationSubRef.current?.remove();
    locationSubRef.current = null;
    appStateSubRef.current?.remove();
    appStateSubRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (checkpointIntervalRef.current) { clearInterval(checkpointIntervalRef.current); checkpointIntervalRef.current = null; }
    deactivateKeepAwake();

    if (liveSharingEnabledRef.current && playerIdRef.current) {
      clearLivePosition(playerIdRef.current).catch(() => {});
    }

    // Stop background task and merge any remaining buffered points.
    // CRITICAL PATH: same pause guard as the resume-drain — if the run was paused when
    // finished, the buffered tail was accumulated during a paused/backgrounded window
    // and must not be added to distance.
    await stopBackgroundTracking();
    const bgTail = drainBgGpsBuffer(runIdRef.current);
    if (bgTail.length > 0 && !isPausedRef.current) mergeBgPoints(bgTail);

    feedback.runComplete();

    // Worked out now, not read from the last throttled update: the live pace
    // lagged up to a second of fixes, and missed the screen-off tail merged just
    // above (P1-12). A run finished while paused stops its clock at the pause.
    const endAt = isPausedRef.current && pauseStartRef.current ? pauseStartRef.current : Date.now();
    const finalDistance = totalDistanceRef.current;
    const finalElapsed  = Math.max(0, Math.floor((endAt - startTimeRef.current - totalPausedMsRef.current) / 1000));
    const finalPace     = finalElapsed > 0 ? formatPace(finalDistance / finalElapsed) : paceRef.current;
    elapsedRef.current  = finalElapsed;
    paceRef.current     = finalPace;
    const finalRunId    = runIdRef.current;

    setState(prev => ({ ...prev, isRunning: false, isPaused: false, distance: finalDistance }));

    // A throw (SQLite write failure) or an undefined result (player state not yet
    // loaded — see useGameEngine's `if (!player) return;` guard) used to leave
    // isFinishingRef permanently true: every later finish attempt returned null
    // immediately and the run could never be saved or retried. GPS/timers are
    // already torn down above and the crash checkpoint is deliberately left in
    // place (only cleared after a confirmed save below), so resetting the guard
    // and returning null lets the caller show a retry affordance instead of a
    // silently frozen screen.
    let result;
    try {
      result = await gameEngine.endRunSession({
        id:             finalRunId,
        activityType:   activityType,
        startTime:      startTimeRef.current,
        endTime:        Date.now(),
        distanceMeters: finalDistance * 1000,
        durationSec:    finalElapsed,
        avgPace:        finalPace,
        gpsPoints:      gpsPointsRef.current,
        elevationGainM: Math.round(elevationGainRef.current),
        ...(mockedLocationRef.current && { mockedLocation: true }),
      });
    } catch (err) {
      console.error('[useActiveRun] endRunSession threw:', err);
      isFinishingRef.current = false;
      return null;
    }
    if (!result) {
      isFinishingRef.current = false;
      return null;
    }

    // Run is now saved to IndexedDB — safe to discard the crash checkpoint
    const cpKey = `${GPS_CHECKPOINT_PREFIX}${finalRunId}`;
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter(k => k === cpKey || k.startsWith(`${cpKey}#`));
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    } catch { /* a leftover checkpoint is offered for recovery, then cleared */ }

    return {
      runId:               finalRunId,
      distance:            finalDistance,
      elapsed:             finalElapsed,
      pace:                finalPace,
      gpsPoints:           gpsPointsRef.current,
      territoriesClaimed:  (result as any)?.run?.territoriesClaimed?.length ?? 0,
      ...result,
    };
  }, [gameEngine, mergeBgPoints, activityType]);

  return {
    ...state,
    gpsLocked,
    backgroundWarning,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    activeRunId:          runIdRef.current,
    /** L5: live climb so far, for the HUD's switchable metric. */
    elevationGainM:       Math.round(elevationGainRef.current),
    gpsCheckpointPrefix:  GPS_CHECKPOINT_PREFIX,
    player:               gameEngine.player,
    playerTerritoryCount: gameEngine.playerTerritoryCount,
  };
}
