/**
 * Native version of useActiveRun — replaces browser geolocation with
 * expo-location and WakeLock with expo-keep-awake.
 * Integrates with the background location task for screen-off tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedback } from '@theme';
import { track } from '@shared/services/analytics';
import { useGameEngine } from '@shared/hooks/useGameEngine';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  drainBgGpsBuffer,
  clearBgGpsBuffer,
} from '../services/locationTask';

const GPS_CHECKPOINT_INTERVAL_MS = 30_000;
const GPS_CHECKPOINT_PREFIX = 'run_checkpoint_';
const GPS_LOCK_REQUIRED_POINTS = 3;

/** Returns any checkpoint key written by an interrupted run (crash recovery). */
export async function findInterruptedRunCheckpoint(): Promise<{ runId: string; startTime: number; points: GPSPoint[] } | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const checkpointKey = keys.find(k => k.startsWith(GPS_CHECKPOINT_PREFIX));
    if (!checkpointKey) return null;
    const raw = await AsyncStorage.getItem(checkpointKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { startTime: number; points: GPSPoint[] };
    const runId = checkpointKey.slice(GPS_CHECKPOINT_PREFIX.length);
    return { runId, ...parsed };
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPace(kmPerSec: number): string {
  if (kmPerSec <= 0) return '0:00';
  const secPerKm = 1 / kmPerSec;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.floor(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  const locationSubRef      = useRef<Location.LocationSubscription | null>(null);
  const appStateSubRef      = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkpointIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef        = useRef<number>(0);
  const pauseStartRef     = useRef<number>(0);
  const totalPausedMsRef  = useRef<number>(0);
  const lastPositionRef   = useRef<{ lat: number; lng: number } | null>(null);
  const runIdRef          = useRef<string>('');
  const lastGpsStateUpdateRef = useRef<number>(0);
  const gpsPointsRef      = useRef<GPSPoint[]>([]);
  const pendingDistanceRef = useRef<number>(0);
  const totalDistanceRef  = useRef<number>(0);
  const isFinishingRef    = useRef<boolean>(false);
  const appStateRef       = useRef<AppStateStatus>(AppState.currentState);
  // Refs that mirror state for use inside callbacks/finishRun — avoids stale closures
  const elapsedRef        = useRef<number>(0);
  const paceRef           = useRef<string>('0:00');
  // isPausedRef mirrors isPaused state for use inside GPS callback (avoids stale closure)
  const isPausedRef            = useRef<boolean>(false);
  // gpsLockedRef + consecutiveGoodPointsRef: prevents distance accumulation from iOS stale cache
  const gpsLockedRef           = useRef<boolean>(false);
  const consecutiveGoodPointsRef = useRef(0);
  const prevAltitudeRef        = useRef<number | null>(null);
  const elevationGainRef       = useRef<number>(0);
  const lastKmRef              = useRef<number>(0);


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
    };
  }, []);

  // ── Start ───────────────────────────────────────────────────────────────────
  const startRun = useCallback(async () => {
    // Request foreground permission
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setState(prev => ({ ...prev, gpsError: 'Permission denied — enable location in Settings' }));
      return;
    }

    // Request background permission (soft — if denied, foreground-only tracking still works)
    await Location.requestBackgroundPermissionsAsync().catch(() => {});

    await activateKeepAwakeAsync();

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
        if (bgPoints.length > 0 && !isPausedRef.current) {
          for (const pt of bgPoints) {
            const prev = lastPositionRef.current;
            if (prev) {
              const d = haversineM(prev.lat, prev.lng, pt.lat, pt.lng);
              if (d < 100 && d >= 1) {
                totalDistanceRef.current += d / 1000;
              }
            }
            lastPositionRef.current = { lat: pt.lat, lng: pt.lng };
            gpsPointsRef.current.push({
              lat: pt.lat, lng: pt.lng, timestamp: pt.timestamp,
              speed: pt.speed, accuracy: pt.accuracy, altitude: 0,
            });
          }
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
    lastPositionRef.current  = null;
    runIdRef.current         = crypto.randomUUID();
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
    checkpointIntervalRef.current = setInterval(async () => {
      if (gpsPointsRef.current.length > 0) {
        await AsyncStorage.setItem(cpKey, JSON.stringify({
          startTime: startTimeRef.current,
          points: gpsPointsRef.current,
        })).catch(() => {});
      }
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
      setState(prev => {
        if (prev.isPaused) return prev;
        const totalElapsed = Math.floor(
          (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000,
        );
        elapsedRef.current = totalElapsed;
        return { ...prev, elapsed: totalElapsed };
      });
    }, 1000);

    // GPS watcher
    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy:     Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 3,
      },
      (location) => {
        // Skip GPS points while paused — prevents distance inflation
        if (isPausedRef.current) return;

        const { latitude, longitude, speed, accuracy, altitude } = location.coords;
        const now = Date.now();
        const gpsSpeed = speed ?? 0;

        // Skip low-accuracy points (same threshold as claim engine)
        if ((accuracy ?? 100) > 30) {
          consecutiveGoodPointsRef.current = 0;
          return;
        }

        // Require 3 consecutive accurate points before trusting GPS — prevents
        // iOS stale-cache snap (the "California bug") from inflating distance.
        consecutiveGoodPointsRef.current++;
        if (!gpsLockedRef.current && consecutiveGoodPointsRef.current >= GPS_LOCK_REQUIRED_POINTS) {
          gpsLockedRef.current = true;
          setGpsLocked(true);
        }
        if (!gpsLockedRef.current) return;

        let deltaKm = 0;
        if (lastPositionRef.current) {
          const d = haversineM(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            latitude,
            longitude,
          );
          if (d >= 100) {
            // GPS teleport / bad lock — skip
            lastPositionRef.current = { lat: latitude, lng: longitude };
            return;
          }
          if (d >= 1) {
            deltaKm = d / 1000;
            pendingDistanceRef.current += deltaKm;
            totalDistanceRef.current   += deltaKm;
          }
        }
        lastPositionRef.current = { lat: latitude, lng: longitude };

        // Accumulate elevation gain (>0.5m threshold filters out GPS altitude noise)
        const alt = altitude ?? 0;
        if (prevAltitudeRef.current !== null && alt > prevAltitudeRef.current + 0.5) {
          elevationGainRef.current += alt - prevAltitudeRef.current;
        }
        prevAltitudeRef.current = alt;

        if (!isFinite(latitude) || !isFinite(longitude)) return;
        gpsPointsRef.current.push({ lat: latitude, lng: longitude, timestamp: now, speed: gpsSpeed, accuracy: accuracy ?? 10, altitude: alt });

        // Throttle React state updates to max 1/sec
        if (now - lastGpsStateUpdateRef.current < 1000) return;
        lastGpsStateUpdateRef.current = now;

        setState(prev => {
          if (prev.isPaused) return prev;
          const newDistance = prev.distance + pendingDistanceRef.current;
          pendingDistanceRef.current = 0;
          const elapsedSec = elapsedRef.current > 0 ? elapsedRef.current : 1;
          const pace = formatPace(newDistance / elapsedSec);
          paceRef.current = pace;

          // Km milestone feedback
          const currentKm = Math.floor(totalDistanceRef.current);
          if (currentKm > lastKmRef.current) {
            lastKmRef.current = currentKm;
            feedback.kmTick();
          }

          return {
            ...prev,
            distance:     Math.round(newDistance * 1000) / 1000,
            pace,
            currentSpeed: gpsSpeed,
            gpsPoints:    [...gpsPointsRef.current],
          };
        });
      },
    );

    // Start background location task for screen-off tracking
    startBackgroundTracking(runIdRef.current).catch(err =>
      console.warn('[useActiveRun] background tracking unavailable:', err)
    );

    lastKmRef.current = 0;
  }, [gameEngine]);

  // ── Pause / Resume ──────────────────────────────────────────────────────────
  const pauseRun = useCallback(() => {
    isPausedRef.current = true;
    setState(prev => ({ ...prev, isPaused: true }));
    pauseStartRef.current = Date.now();
    feedback.runPause();
  }, []);

  const resumeRun = useCallback(() => {
    totalPausedMsRef.current += Date.now() - pauseStartRef.current;
    // Reset last position so the first point after resume doesn't create a large delta
    lastPositionRef.current = null;
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

    // Stop background task and merge any remaining buffered points.
    // CRITICAL PATH: same pause guard as the resume-drain — if the run was paused when
    // finished, the buffered tail was accumulated during a paused/backgrounded window
    // and must not be added to distance.
    await stopBackgroundTracking();
    const bgTail = drainBgGpsBuffer(runIdRef.current);
    if (bgTail.length > 0 && !isPausedRef.current) {
      for (const pt of bgTail) {
        const prev = lastPositionRef.current;
        if (prev) {
          const d = haversineM(prev.lat, prev.lng, pt.lat, pt.lng);
          if (d < 100 && d >= 1) totalDistanceRef.current += d / 1000;
        }
        lastPositionRef.current = { lat: pt.lat, lng: pt.lng };
        gpsPointsRef.current.push({
          lat: pt.lat, lng: pt.lng, timestamp: pt.timestamp,
          speed: pt.speed, accuracy: pt.accuracy, altitude: 0,
        });
      }
    }

    feedback.runComplete();

    // Use refs — not state — so finalElapsed/finalPace are always current
    const finalDistance = totalDistanceRef.current;
    const finalElapsed  = elapsedRef.current;
    const finalPace     = paceRef.current;
    const finalRunId    = runIdRef.current;

    setState(prev => ({ ...prev, isRunning: false, isPaused: false, distance: finalDistance }));

    const result = await gameEngine.endRunSession({
      id:             finalRunId,
      activityType:   activityType,
      startTime:      startTimeRef.current,
      endTime:        Date.now(),
      distanceMeters: finalDistance * 1000,
      durationSec:    finalElapsed,
      avgPace:        finalPace,
      gpsPoints:      gpsPointsRef.current,
      elevationGainM: Math.round(elevationGainRef.current),
    });

    // Run is now saved to IndexedDB — safe to discard the crash checkpoint
    await AsyncStorage.removeItem(`${GPS_CHECKPOINT_PREFIX}${finalRunId}`).catch(() => {});

    return {
      runId:               finalRunId,
      distance:            finalDistance,
      elapsed:             finalElapsed,
      pace:                finalPace,
      gpsPoints:           gpsPointsRef.current,
      territoriesClaimed:  (result as any)?.run?.territoriesClaimed?.length ?? 0,
      ...result,
    };
  }, [gameEngine]);

  return {
    ...state,
    gpsLocked,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    activeRunId:          runIdRef.current,
    gpsCheckpointPrefix:  GPS_CHECKPOINT_PREFIX,
    player:               gameEngine.player,
    playerTerritoryCount: gameEngine.playerTerritoryCount,
  };
}
