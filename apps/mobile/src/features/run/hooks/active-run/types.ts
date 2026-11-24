/**
 * Shared types and the mutable session object for the active-run hooks.
 *
 * Everything the GPS callback, the 1 s timer and the checkpoint all read and write
 * lives in ONE plain object (`RunSession`), created once per hook instance and passed
 * to each sub-hook. Callbacks run long after the render that created them, so they
 * must never close over React state: they read `session.x` at the moment they fire,
 * which is what keeps them free of stale closures.
 *
 * Nothing here imports React Native or Expo, so the pure helpers built on it
 * (autoPause, bgMerge, finalize) can be unit-tested in Node.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppStateStatus } from 'react-native';
import type { Fix } from '../../services/gpsFilter';

export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
  accuracy: number;
  altitude: number;
}

/** The React state the screen renders from (the rest is in RunSession). */
export interface ActiveRunState {
  isRunning: boolean;
  isPaused: boolean;
  elapsed: number;
  distance: number;
  pace: string;
  currentSpeed: number;
  gpsPoints: GPSPoint[];
  gpsError: string | null;
}

export const INITIAL_RUN_STATE: ActiveRunState = {
  isRunning:    false,
  isPaused:     false,
  elapsed:      0,
  distance:     0,
  pace:         '0:00',
  currentSpeed: 0,
  gpsPoints:    [],
  gpsError:     null,
};

/** Mutable per-run values, read at call time by callbacks, never closed over. */
export interface RunSession {
  // Clock
  startTime: number;
  pauseStart: number;
  totalPausedMs: number;
  elapsed: number;
  pace: string;
  isPaused: boolean;
  // Identity and lifecycle
  runId: string;
  isFinishing: boolean;
  isStarting: boolean;
  appState: AppStateStatus;
  // GPS
  /** Distance filter state (gpsFilter): the last fix distance is measured from, and the outlier streak. */
  filter: { base: Fix | null; outliers: number };
  gpsPoints: GPSPoint[];
  pendingDistance: number;
  totalDistance: number;
  lastGpsStateUpdate: number;
  gpsLocked: boolean;
  /** Time of the last fix accepted while locked; a stale one means signal loss. */
  lastGoodFixAt: number;
  consecutiveGoodPoints: number;
  /** One fix from a mock-location provider flags the whole run (security audit H1). */
  mocked: boolean;
  prevAltitude: number | null;
  elevationGain: number;
  lastKm: number;
  // Auto-pause: tells a user-tapped pause from one this hook triggered itself.
  autoPauseEnabled: boolean;
  manualPause: boolean;
  autoPaused: boolean;
  stoppedSince: number | null;
  lastMovingFixAt: number;
  /** Only phones that report speed can auto-resume, so only they auto-pause from the timer. */
  speedKnown: boolean;
  // Live run sharing
  liveSharingEnabled: boolean;
  lastLiveBroadcast: number;
  playerId: string | null;
}

/** Setters the sub-hooks drive the screen with. All stable for the life of the hook. */
export interface RunUi {
  setState: Dispatch<SetStateAction<ActiveRunState>>;
  setGpsLocked: (locked: boolean) => void;
  setBackgroundWarning: (message: string | null) => void;
}

// ── Tunables ─────────────────────────────────────────────────────────────────
/** Consecutive accurate fixes required before GPS is trusted (iOS stale-cache snap). */
export const GPS_LOCK_REQUIRED_POINTS = 3;
/** No accepted fix for this long while running = signal lost. */
export const GPS_STALE_MS = 10_000;
/** Below ~1.8 km/h counts as stopped (well under walking pace). */
export const AUTO_PAUSE_SPEED_MS = 0.5;
/** 8 s of that before auto-pausing absorbs a red light or photo stop. */
export const AUTO_PAUSE_DELAY_MS = 8_000;
/** How often a running position reaches friends: battery/bandwidth, not every ~1/s fix. */
export const LIVE_SHARE_INTERVAL_MS = 6_000;
