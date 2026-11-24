/**
 * Live Run Sharing from the active run. Fire-and-forget, throttled independently of the
 * 1 s state update. It only reaches mutual connections who also opted in (enforced
 * server-side, see live_run_positions RLS); the checks here are just "don't even try"
 * when the setting is off.
 */
import { upsertLivePosition, clearLivePosition } from '@shared/services/liveRunSharing';
import { LIVE_SHARE_INTERVAL_MS, type RunSession } from './types';

/** Removes the runner's marker from friends' maps (on pause, finish and unmount). */
export function clearLiveShare(s: RunSession): void {
  if (s.liveSharingEnabled && s.playerId) {
    clearLivePosition(s.playerId).catch(() => {});
  }
}

/** Sends the current position at most every LIVE_SHARE_INTERVAL_MS. */
export function broadcastLivePosition(s: RunSession, lat: number, lng: number, now: number): void {
  if (!s.liveSharingEnabled || !s.playerId || now - s.lastLiveBroadcast < LIVE_SHARE_INTERVAL_MS) return;
  s.lastLiveBroadcast = now;
  upsertLivePosition(s.playerId, s.runId, lat, lng, {
    startedAt: s.startTime, distanceM: s.totalDistance * 1000, elapsedSec: s.elapsed,
  }).catch(() => {});
}
