import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameEngine } from '@shared/hooks/useGameEngine';
import { ClaimEvent } from '@features/territory/services/claimEngine';
import { haptic } from '@shared/lib/haptics';
import { soundManager } from '@shared/audio/sounds';

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
  accuracy: number;
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
}

export function useActiveRun() {
  const gameEngine = useGameEngine();

  const [state, setState] = useState<ActiveRunState>({
    isRunning: false,
    isPaused: false,
    elapsed: 0,
    distance: 0,
    pace: '0:00',
    currentSpeed: 0,
    gpsPoints: [],
    claimProgress: 0,
    territoriesClaimed: 0,
    lastClaimEvent: null,
    energyBlocked: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const runIdRef = useRef<string>(crypto.randomUUID());
  const lastGpsStateUpdateRef = useRef<number>(0);
  const gpsPointsRef = useRef<GPSPoint[]>([]);
  const pendingDistanceRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsub = gameEngine.onClaimEvent((event: ClaimEvent) => {
      setState(prev => ({ ...prev, lastClaimEvent: event }));

      switch (event.type) {
        case 'claim_progress':
          setState(prev => ({ ...prev, claimProgress: event.progress ?? 0 }));
          if (event.progress && event.progress % 25 < 5) {
            soundManager.play('tick', 0.3);
          }
          break;
        case 'claimed':
          setState(prev => ({
            ...prev,
            territoriesClaimed: prev.territoriesClaimed + 1,
            claimProgress: 0,
            energyBlocked: false,
          }));
          haptic('success');
          soundManager.play('claim');
          setTimeout(() => soundManager.play('coin', 0.4), 300);
          setTimeout(() => {
            setState(prev => {
              if (prev.lastClaimEvent?.type === 'claimed') {
                return { ...prev, lastClaimEvent: null };
              }
              return prev;
            });
          }, 4000);
          break;
        case 'energy_blocked':
          setState(prev => ({ ...prev, energyBlocked: true }));
          haptic('light');
          break;
      }
    });

    return unsub;
  }, [gameEngine]);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatPace = (kmPerSec: number): string => {
    if (kmPerSec <= 0) return '0:00';
    const secPerKm = 1 / kmPerSec;
    const minutes = Math.floor(secPerKm / 60);
    const seconds = Math.floor(secPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startRun = useCallback(async () => {
    await gameEngine.startClaimEngine();

    startTimeRef.current = Date.now();
    pauseStartRef.current = 0;
    totalPausedMsRef.current = 0;
    lastPositionRef.current = null;
    runIdRef.current = crypto.randomUUID();
    gpsPointsRef.current = [];
    pendingDistanceRef.current = 0;

    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      elapsed: 0,
      distance: 0,
      pace: '0:00',
      gpsPoints: [],
      territoriesClaimed: 0,
      claimProgress: 0,
      lastClaimEvent: null,
    }));

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.isPaused) return prev;
        const now = Date.now();
        const totalElapsed = Math.floor(
          (now - startTimeRef.current - totalPausedMsRef.current) / 1000
        );
        return { ...prev, elapsed: totalElapsed };
      });
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy } = position.coords;
        const now = Date.now();
        const gpsSpeed = speed ?? 0;

        let deltaKm = 0;
        if (lastPositionRef.current) {
          const d = haversine(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            latitude,
            longitude
          );
          if (d >= 100) {
            // GPS teleport / bad initial lock — skip this point entirely
            lastPositionRef.current = { lat: latitude, lng: longitude };
            return;
          }
          if (d >= 1) {
            deltaKm = d / 1000;
            pendingDistanceRef.current += deltaKm;
          }
          // d < 1: sub-metre — still add the point for trail density, just don't count distance
        }
        lastPositionRef.current = { lat: latitude, lng: longitude };
        // Pass distanceDelta so energy regenerates in real-time
        gameEngine.updateClaim(latitude, longitude, gpsSpeed, accuracy, deltaKm);

        const point: GPSPoint = {
          lat: latitude,
          lng: longitude,
          timestamp: now,
          speed: gpsSpeed,
          accuracy,
        };
        gpsPointsRef.current.push(point);

        // Throttle React state updates to max 1 per second
        if (now - lastGpsStateUpdateRef.current < 1000) return;
        lastGpsStateUpdateRef.current = now;

        setState(prev => {
          if (prev.isPaused) return prev;

          const newDistance = prev.distance + pendingDistanceRef.current;
          pendingDistanceRef.current = 0;

          const elapsedSec = prev.elapsed > 0 ? prev.elapsed : 1;
          const kmPerSec = newDistance / elapsedSec;
          const pace = formatPace(kmPerSec);

          return {
            ...prev,
            distance: Math.round(newDistance * 1000) / 1000,
            pace,
            currentSpeed: gpsSpeed,
            gpsPoints: [...gpsPointsRef.current],
          };
        });
      },
      (error) => {
        console.error('GPS Error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
      }
    );

    haptic('medium');
    soundManager.play('start_run');
  }, [gameEngine]);

  const pauseRun = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
    pauseStartRef.current = Date.now();
    haptic('light');
  }, []);

  const resumeRun = useCallback(() => {
    totalPausedMsRef.current += Date.now() - pauseStartRef.current;
    setState(prev => ({ ...prev, isPaused: false }));
    haptic('light');
  }, []);

  const finishRun = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
    haptic('success');
    soundManager.play('finish_run');

    const finalDistance = state.distance + pendingDistanceRef.current;

    const result = await gameEngine.endRunSession({
      id: runIdRef.current,
      activityType: 'run',
      startTime: startTimeRef.current,
      endTime: Date.now(),
      distanceMeters: finalDistance * 1000,
      durationSec: state.elapsed,
      avgPace: state.pace,
      gpsPoints: gpsPointsRef.current,
    });

    return {
      runId: runIdRef.current,
      ...state,
      distance: finalDistance,
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
    player: gameEngine.player,
    sessionStats: gameEngine.sessionStats,
    sessionEnergy: gameEngine.sessionEnergy,
  };
}
