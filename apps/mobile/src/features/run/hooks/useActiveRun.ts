/**
 * Native version of useActiveRun — replaces browser geolocation with
 * expo-location and WakeLock with expo-keep-awake.
 * Integrates with the background location task for screen-off tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useGameEngine } from '@shared/hooks/useGameEngine';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  drainBgGpsBuffer,
  clearBgGpsBuffer,
} from '../services/locationTask';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
  accuracy: number;
}

interface ClaimEvent {
  type: 'claim_progress' | 'claimed' | 'energy_blocked';
  progress?: number;
  xpEarned?: number;
  coinsEarned?: number;
  timestamp: number;
}

interface ActiveRunState {
  isRunning: boolean;
  isPaused: boolean;
  elapsed: number;
  distance: number;
  pace: string;
  currentSpeed: number;
  gpsPoints: GPSPoint[];
  claimProgress: number;
  territoriesClaimed: number;
  lastClaimEvent: ClaimEvent | null;
  energyBlocked: boolean;
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
export function useActiveRun() {
  const gameEngine = useGameEngine();

  const [state, setState] = useState<ActiveRunState>({
    isRunning:          false,
    isPaused:           false,
    elapsed:            0,
    distance:           0,
    pace:               '0:00',
    currentSpeed:       0,
    gpsPoints:          [],
    claimProgress:      0,
    territoriesClaimed: 0,
    lastClaimEvent:     null,
    energyBlocked:      false,
    gpsError:           null,
  });

  const locationSubRef    = useRef<Location.LocationSubscription | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef      = useRef<number>(0);
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

  // ── Claim events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = gameEngine.onClaimEvent((event: ClaimEvent) => {
      setState(prev => ({ ...prev, lastClaimEvent: event }));

      switch (event.type) {
        case 'claim_progress':
          setState(prev => ({ ...prev, claimProgress: event.progress ?? 0 }));
          break;
        case 'claimed':
          setState(prev => ({
            ...prev,
            territoriesClaimed: prev.territoriesClaimed + 1,
            claimProgress:      0,
            energyBlocked:      false,
          }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            setState(prev =>
              prev.lastClaimEvent?.type === 'claimed' ? { ...prev, lastClaimEvent: null } : prev
            );
          }, 4000);
          break;
        case 'energy_blocked':
          setState(prev => ({ ...prev, energyBlocked: true }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    });
    return unsub;
  }, [gameEngine]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      locationSubRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
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

    await gameEngine.startClaimEngine();
    await activateKeepAwakeAsync();

    // App state handler: re-acquire keep-awake on foreground resume + drain bg buffer
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        await activateKeepAwakeAsync();
        // Drain GPS points collected while screen was off
        const bgPoints = drainBgGpsBuffer(runIdRef.current);
        if (bgPoints.length > 0) {
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
              speed: pt.speed, accuracy: pt.accuracy,
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
    runIdRef.current         = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    gpsPointsRef.current     = [];
    pendingDistanceRef.current = 0;
    totalDistanceRef.current   = 0;
    isFinishingRef.current     = false;

    setState(prev => ({
      ...prev,
      isRunning:          true,
      isPaused:           false,
      elapsed:            0,
      distance:           0,
      pace:               '0:00',
      gpsPoints:          [],
      territoriesClaimed: 0,
      claimProgress:      0,
      lastClaimEvent:     null,
      gpsError:           null,
    }));

    // 1-second timer
    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.isPaused) return prev;
        const totalElapsed = Math.floor(
          (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000,
        );
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
        const { latitude, longitude, speed, accuracy } = location.coords;
        const now = Date.now();
        const gpsSpeed = speed ?? 0;

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

        gameEngine.updateClaim(latitude, longitude, gpsSpeed, accuracy ?? 10, deltaKm);

        gpsPointsRef.current.push({ lat: latitude, lng: longitude, timestamp: now, speed: gpsSpeed, accuracy: accuracy ?? 10 });

        // Throttle React state updates to max 1/sec
        if (now - lastGpsStateUpdateRef.current < 1000) return;
        lastGpsStateUpdateRef.current = now;

        setState(prev => {
          if (prev.isPaused) return prev;
          const newDistance = prev.distance + pendingDistanceRef.current;
          pendingDistanceRef.current = 0;
          const elapsedSec = prev.elapsed > 0 ? prev.elapsed : 1;
          const pace = formatPace(newDistance / elapsedSec);
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [gameEngine]);

  // ── Pause / Resume ──────────────────────────────────────────────────────────
  const pauseRun = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
    pauseStartRef.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resumeRun = useCallback(() => {
    totalPausedMsRef.current += Date.now() - pauseStartRef.current;
    setState(prev => ({ ...prev, isPaused: false }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Finish ──────────────────────────────────────────────────────────────────
  const finishRun = useCallback(async () => {
    if (isFinishingRef.current) return null;
    isFinishingRef.current = true;

    locationSubRef.current?.remove();
    locationSubRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    deactivateKeepAwake();

    // Stop background task and merge any remaining buffered points
    await stopBackgroundTracking();
    const bgTail = drainBgGpsBuffer(runIdRef.current);
    if (bgTail.length > 0) {
      for (const pt of bgTail) {
        const prev = lastPositionRef.current;
        if (prev) {
          const d = haversineM(prev.lat, prev.lng, pt.lat, pt.lng);
          if (d < 100 && d >= 1) totalDistanceRef.current += d / 1000;
        }
        lastPositionRef.current = { lat: pt.lat, lng: pt.lng };
        gpsPointsRef.current.push({
          lat: pt.lat, lng: pt.lng, timestamp: pt.timestamp,
          speed: pt.speed, accuracy: pt.accuracy,
        });
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const finalDistance = totalDistanceRef.current;
    const finalElapsed  = state.elapsed;
    const finalPace     = state.pace;

    setState(prev => ({ ...prev, isRunning: false, isPaused: false, distance: finalDistance }));

    const result = await gameEngine.endRunSession({
      id:             runIdRef.current,
      activityType:   'run',
      startTime:      startTimeRef.current,
      endTime:        Date.now(),
      distanceMeters: finalDistance * 1000,
      durationSec:    finalElapsed,
      avgPace:        finalPace,
      gpsPoints:      gpsPointsRef.current,
    });

    return {
      runId:    runIdRef.current,
      ...state,
      distance: finalDistance,
      elapsed:  finalElapsed,
      pace:     finalPace,
      gpsPoints: gpsPointsRef.current,
      ...result,
    };
  }, [gameEngine, state]);

  return {
    ...state,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    player:       gameEngine.player,
    sessionStats: gameEngine.sessionStats,
    sessionEnergy: gameEngine.sessionEnergy,
  };
}
