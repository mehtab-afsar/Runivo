export interface BufferedFix { lat: number; lng: number; speed: number; accuracy: number; timestamp: number }

/**
 * Which screen-off fixes are new. On iOS the live watcher keeps receiving
 * fixes while the screen is locked and the background task buffers the same
 * ones, so only fixes newer than the last recorded point are new (merging the
 * whole buffer counted every screen-off stretch twice). On Android, where the
 * watcher stops in the background, that is all of them. Distance for them is
 * worked out by the same filter as live fixes (gpsFilter).
 */
export function freshScreenOffFixes(lastRecordedTs: number, buffered: BufferedFix[]): BufferedFix[] {
  return buffered.filter(p => p.timestamp > lastRecordedTs).sort((a, b) => a.timestamp - b.timestamp);
}
