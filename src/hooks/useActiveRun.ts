import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameEngine } from './useGameEngine';
import { ClaimEvent, ClaimState } from '../game/claimEngine';
import { haptic } from '../lib/haptics';
import { seedTerritoryData } from '../game/seedData';
import { soundManager } from '../audio/sounds';

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
  claimState: ClaimState | null;
  currentZone: 'owned' | 'enemy' | 'neutral' | null;
  claimProgress: number;
  territoriesClaimed: number;
  lastClaimEvent: ClaimEvent | null;
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
    claimState: null,
    currentZone: null,
    claimProgress: 0,
    territoriesClaimed: 0,
    lastClaimEvent: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const runIdRef = useRef<string>(crypto.randomUUID());
  const seededRef = useRef(false);

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
        case 'entered_own':
          setState(prev => ({ ...prev, currentZone: 'owned' }));
          haptic('light');
          soundManager.play('own_zone');
          break;
        case 'entered_enemy':
          setState(prev => ({ ...prev, currentZone: 'enemy' }));
          haptic('medium');
          soundManager.play('enemy_zone');
          break;
        case 'entered_neutral':
          setState(prev => ({ ...prev, currentZone: 'neutral' }));
          haptic('light');
          break;
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
            currentZone: 'owned',
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
        case 'fortified':
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
    if (!seededRef.current) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        await seedTerritoryData(pos.coords.latitude, pos.coords.longitude);
        seededRef.current = true;
      } catch (e) {
        console.warn('Failed to seed territory data:', e);
      }
    }

    await gameEngine.startClaimEngine();

    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    lastPositionRef.current = null;
    runIdRef.current = crypto.randomUUID();

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
      currentZone: null,
      lastClaimEvent: null,
    }));

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.isPaused) return prev;
        const now = Date.now();
        const totalElapsed = Math.floor(
          (now - startTimeRef.current - pausedTimeRef.current) / 1000
        );
        return { ...prev, elapsed: totalElapsed };
      });
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy } = position.coords;
        const now = Date.now();
        const gpsSpeed = speed ?? 0;

        const point: GPSPoint = {
          lat: latitude,
          lng: longitude,
          timestamp: now,
          speed: gpsSpeed,
          accuracy,
        };

        setState(prev => {
          if (prev.isPaused) return prev;

          let newDistance = prev.distance;

          if (lastPositionRef.current) {
            const d = haversine(
              lastPositionRef.current.lat,
              lastPositionRef.current.lng,
              latitude,
              longitude
            );
            if (d > 2 && d < 100) {
              newDistance += d / 1000;
            }
          }
          lastPositionRef.current = { lat: latitude, lng: longitude };

          const elapsedSec = prev.elapsed > 0 ? prev.elapsed : 1;
          const kmPerSec = newDistance / elapsedSec;
          const pace = formatPace(kmPerSec);

          gameEngine.updateClaim(latitude, longitude, gpsSpeed, accuracy);

          return {
            ...prev,
            distance: Math.round(newDistance * 1000) / 1000,
            pace,
            currentSpeed: gpsSpeed,
            gpsPoints: [...prev.gpsPoints, point],
          };
        });
      },
      (error) => {
        console.error('GPS Error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    haptic('medium');
    soundManager.play('start_run');
  }, [gameEngine]);

  const pauseRun = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
    pausedTimeRef.current = Date.now();
    haptic('light');
  }, []);

  const resumeRun = useCallback(() => {
    const pauseDuration = Date.now() - pausedTimeRef.current;
    pausedTimeRef.current = pauseDuration;
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

    const result = await gameEngine.endRunSession({
      id: runIdRef.current,
      activityType: 'run',
      startTime: startTimeRef.current,
      endTime: Date.now(),
      distanceMeters: state.distance * 1000,
      durationSec: state.elapsed,
      avgPace: state.pace,
      gpsPoints: state.gpsPoints,
    });

    return {
      runId: runIdRef.current,
      ...state,
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
  };
}
