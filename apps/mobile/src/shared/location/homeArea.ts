import { AppState } from 'react-native';
import { getPlayer, savePlayer } from '@shared/services/store';
import { pushProfile } from '@shared/services/sync';
import { positionIfAllowed } from './devicePosition';

/**
 * Keeps the runner's home area (profiles.last_known_location) current.
 *
 * Runners near you, the local leaderboard, clubs and events near you and the
 * city rank all read it. It used to be set only by the onboarding location
 * step, so anyone who skipped that step, or signed up before it existed,
 * stayed blank on all of those for good.
 *
 * Never asks for permission. Rounded to two decimals (about 1 km), and only
 * sent when it's missing or the runner has moved about 2 km or more.
 */
const ROUND = 100;          // 0.01° ≈ 1.1 km
const MOVED_DEG = 0.02;     // ≈ 2 km
const MIN_GAP_MS = 6 * 60 * 60 * 1000;
let lastCheck = 0;
let inFlight: Promise<void> | null = null;

export function refreshHomeArea(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastCheck < MIN_GAP_MS) return Promise.resolve();
  lastCheck = Date.now();
  inFlight = (async () => {
    const pos = await positionIfAllowed();
    if (!pos) return;
    const player = await getPlayer();
    if (!player) return;
    const next = { lat: Math.round(pos.lat * ROUND) / ROUND, lng: Math.round(pos.lng * ROUND) / ROUND };
    const prev = player.lastKnownLocation;
    if (prev && Math.abs(prev.lat - next.lat) < MOVED_DEG && Math.abs(prev.lng - next.lng) < MOVED_DEG) return;
    await savePlayer({ ...player, lastKnownLocation: next });
    await pushProfile();
  })().catch(() => {}).finally(() => { inFlight = null; });
  return inFlight;
}

/** Checks now and whenever the app comes back to the foreground. Returns an unsubscribe. */
export function watchHomeArea(): () => void {
  refreshHomeArea(true);
  const sub = AppState.addEventListener('change', s => { if (s === 'active') refreshHomeArea(); });
  return () => sub.remove();
}
