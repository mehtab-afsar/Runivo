import { haversineM } from '@shared/services/claimEngine';

export interface BufferedFix { lat: number; lng: number; speed: number; accuracy: number; timestamp: number }

/**
 * Which screen-off fixes to add to a run, and how much distance they add.
 *
 * On iOS the live watcher keeps receiving fixes while the screen is locked and
 * the background task buffers the same ones, so only fixes newer than the last
 * recorded point are new. On Android, where the watcher stops in the
 * background, that is all of them. Steps under 1 m (jitter) or 100 m and over
 * (a bad fix) add no distance, the same rule as the live watcher.
 */
export function screenOffAdditions(
  lastRecordedTs: number,
  lastPos: { lat: number; lng: number } | null,
  buffered: BufferedFix[],
): { fresh: BufferedFix[]; addedKm: number; lastPos: { lat: number; lng: number } | null } {
  const fresh = buffered.filter(p => p.timestamp > lastRecordedTs).sort((a, b) => a.timestamp - b.timestamp);
  let km = 0;
  let prev = lastPos;
  for (const p of fresh) {
    if (prev) {
      const d = haversineM(prev, p);
      if (d >= 1 && d < 100) km += d / 1000;
    }
    prev = { lat: p.lat, lng: p.lng };
  }
  return { fresh, addedKm: km, lastPos: prev };
}
