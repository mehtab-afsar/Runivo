/**
 * The foreground GPS callback: one call per fix from watchPositionAsync.
 *
 * Order matters and is unchanged from the original hook: auto-pause/resume, accuracy
 * gate, lock-on (3 consecutive accurate fixes), distance filter, elevation, trace,
 * live sharing, then the throttled (1/s) state update.
 */
import type { LocationObject } from 'expo-location';
import { feedback } from '@theme';
import { GAME_CONFIG } from '@shared/services/config';
import { formatPace } from '@shared/lib/paceFormat';
import { addFixes } from '../../services/gpsFilter';
import { autoPauseFromFix } from './autoPause';
import { trackElevation } from './elevation';
import { broadcastLivePosition, clearLiveShare } from './liveShare';
import { maxSpeedFor } from './gpsConfig';
import { GPS_LOCK_REQUIRED_POINTS, type RunSession, type RunUi } from './types';

export function createFixHandler(s: RunSession, ui: RunUi, activityType: string) {
  return (location: LocationObject): void => {
    const { latitude, longitude, speed, accuracy, altitude } = location.coords;
    // The fix's own time, the same clock the background buffer stores, so the two can
    // be lined up when merging. iOS gives fractional ms.
    const now = Math.round(location.timestamp || Date.now());
    // iOS reports speed = -1 (and some devices null) when a fix has no valid speed. That
    // is "unknown", not "standing still": reading it as 0 made auto-pause stop the run
    // on any poor fix, and put a negative speed in the trace.
    const speedKnown = typeof speed === 'number' && Number.isFinite(speed) && speed >= 0;
    const gpsSpeed = speedKnown ? (speed as number) : 0;
    if ((location as { mocked?: boolean }).mocked === true) s.mocked = true;
    s.speedKnown = speedKnown;

    const pause = autoPauseFromFix(s, now, gpsSpeed, speedKnown);
    if (pause === 'paused') {
      ui.setState(prev => ({ ...prev, isPaused: true }));
      feedback.runPause();
      clearLiveShare(s);
    } else if (pause === 'resumed') {
      ui.setState(prev => ({ ...prev, isPaused: false }));
      feedback.runStart();
    }

    // Skip GPS points while paused: prevents distance inflation.
    if (s.isPaused) return;

    // Stricter than claimEngine's post-run filter (50 m): a bad point here immediately
    // inflates the live distance/pace the user sees, with no smoothing pass to absorb it.
    if ((accuracy ?? 100) > GAME_CONFIG.GPS_LIVE_ACCURACY_THRESHOLD_M) {
      s.consecutiveGoodPoints = 0;
      return;
    }

    // Require consecutive accurate points before trusting GPS (iOS stale-cache snap).
    s.consecutiveGoodPoints++;
    if (!s.gpsLocked && s.consecutiveGoodPoints >= GPS_LOCK_REQUIRED_POINTS) {
      s.gpsLocked = true;
      s.lastGoodFixAt = now;
      ui.setGpsLocked(true);
    }
    if (!s.gpsLocked) return;
    s.lastGoodFixAt = now;

    if (!isFinite(latitude) || !isFinite(longitude)) return;
    // Spikes ignored, standing drift not counted, tunnel gaps kept.
    const step = addFixes(s.filter, [{ lat: latitude, lng: longitude, timestamp: now, accuracy: accuracy ?? 10 }], maxSpeedFor(activityType));
    s.filter = { base: step.base, outliers: step.outliers };
    if (step.kept.length === 0) return;   // an outlier: not distance, not trace
    const deltaKm = step.addedM / 1000;
    if (deltaKm > 0) {
      s.lastMovingFixAt = now;
      s.pendingDistance += deltaKm;
      s.totalDistance   += deltaKm;
    }

    trackElevation(s, altitude);
    s.gpsPoints.push({ lat: latitude, lng: longitude, timestamp: now, speed: gpsSpeed, accuracy: accuracy ?? 10, altitude: altitude ?? 0 });
    broadcastLivePosition(s, latitude, longitude, now);

    // Throttle React state updates to max 1/sec.
    if (now - s.lastGpsStateUpdate < 1000) return;
    s.lastGpsStateUpdate = now;

    // totalDistance is the one running total (live fixes and merged screen-off fixes
    // alike); state just mirrors it. Feedback and ref writes stay out of the updater
    // (React may run an updater twice in Strict Mode).
    s.pendingDistance = 0;
    const newDistance = s.totalDistance;
    const elapsedSec = s.elapsed > 0 ? s.elapsed : 1;
    const pace = formatPace(newDistance / elapsedSec);
    s.pace = pace;
    const currentKm = Math.floor(newDistance);
    if (currentKm > s.lastKm) {
      s.lastKm = currentKm;
      feedback.kmTick();
    }
    const pointsSnapshot = [...s.gpsPoints];
    ui.setState(prev => (prev.isPaused ? prev : {
      ...prev,
      distance:     Math.round(newDistance * 1000) / 1000,
      pace,
      currentSpeed: gpsSpeed,
      gpsPoints:    pointsSnapshot,
    }));
  };
}
