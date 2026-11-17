/**
 * App-only settings that aren't game rules. Every rule the server also
 * applies (territory, freshness, PACE, ranks, run minimums) lives in ONE place,
 * ENGINE in packages/shared/src/engine/runEngine.ts (V1 audit); read it from
 * there, never copy it here.
 */
export const GAME_CONFIG = {
  // Live run-tracking gate (useActiveRun's foreground watcher + the background
  // location task): stricter than ENGINE.GPS_ACCURACY_THRESHOLD_M, since a bad
  // point directly inflates the distance and pace the runner sees live.
  GPS_LIVE_ACCURACY_THRESHOLD_M: 30,

  // Legacy coin economy (secondary to PACE).
  LOGIN_BONUS_COINS_PER_TERRITORY: 2,
} as const;
