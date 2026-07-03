export const GAME_CONFIG = {
  // Territory geometry
  CORRIDOR_WIDTH_M: 12,
  MAX_RUN_SPEED_MS: 5.5,
  LOOP_CLOSE_DIST_M: 100,
  LOOP_MAX_AREA_M2: 500_000,
  MIN_TERRITORY_DIST_M: 200,
  MIN_GPS_POINTS: 20,
  GPS_ACCURACY_THRESHOLD_M: 50,
  GPS_VARIANCE_MIN: 2.0,

  // Freshness
  FRESHNESS_DECAY_PER_DAY: 10,
  STEAL_THRESHOLD_FRESH: 0.30,
  FRESHNESS_STALE_AT: 40,

  // PACE currency
  PACE_PER_KM: 1,
  PACE_PER_NEW_ZONE: 5,
  PACE_PER_STOLEN_ZONE: 10,
  PACE_STREAK_BONUS: 3,
  PACE_WEEKLY_CAP_FREE: 100,
  PACE_WEEKLY_CAP_PREMIUM: 150,

  // Minimum effort for a session to count as a real run — below this, no streak
  // credit and no streak PACE bonus (prevents "start, immediately stop" farming).
  // Matches the existing "haven't run far enough" warning threshold in ActiveRunScreen.
  MIN_MEANINGFUL_RUN_DISTANCE_M: 50,
  MIN_MEANINGFUL_RUN_DURATION_S: 30,

  // Territory Score
  TS_FRESHNESS_SCALE_MIN: 0.5,
  TS_FRESHNESS_SCALE_MAX: 1.0,

  // Runner Rank thresholds (total PACE all-time)
  RUNNER_RANK_THRESHOLDS: { pacer: 0, strider: 200, chaser: 600, hunter: 1500, sovereign: 4000 } as Record<string, number>,

  // Geography / run-processing (kept from previous config)
  METERS_PER_DEGREE_LAT: 111_320,
  MIN_CLAIM_DISTANCE_M: 200,
  MAX_GPS_SAMPLE_POINTS: 200,
  MS_PER_DAY: 86_400_000,
} as const;
