export const GAME_CONFIG = {
  HEX_RESOLUTION: 9,

  // Capture timing (PRD Part 2)
  CLAIM_NEUTRAL_SEC: 15,
  CLAIM_ENEMY_BASE_SEC: 45,
  CLAIM_ENEMY_PER_DEFENSE_SEC: 1.2,
  SIEGE_TIMEOUT_SEC: 300,
  MIN_SPEED_MPS: 0.8,
  MAX_SPEED_MPS: 12.0,
  GPS_ACCURACY_THRESHOLD: 30,

  // Defense values (PRD Part 2-3)
  CAPTURED_INITIAL_DEFENSE: 30,
  MAX_DEFENSE: 100,
  FORTIFY_DEFENSE_PER_TICK: 4,
  FORTIFY_TICK_SEC: 8,

  // Contiguity bonuses (PRD Part 3)
  ADJACENT_BONUS_DEFENSE: 3,
  CONTIGUITY_INCOME_BONUS: 0.08,

  // Territory decay (PRD Part 3)
  TERRITORY_DECAY_PER_DAY: 10,
  TERRITORY_DECAY_START_DAYS: 3,

  // XP awards
  XP_CLAIM_NEUTRAL: 25,
  XP_CLAIM_ENEMY: 60,
  XP_PER_KM: 30,
  XP_FORTIFY: 10,

  // Speed multiplier (PRD Part 2)
  SPEED_BONUS_THRESHOLD_MPS: 3.5,
  SPEED_BONUS_MULTIPLIER: 1.4,

  // Energy (0-10 scale)
  MAX_ENERGY: 10,
  ENERGY_REGEN_PER_HOUR: 1,
  ENERGY_COST_CLAIM: 1,        // energy spent per territory claimed
  ENERGY_REGEN_PER_KM_RUN: 1, // energy restored per km run in real-time during a run
  ENERGY_COST_SHIELD: 3,
  ENERGY_COST_BOOST: 2,
  ENERGY_COST_SCAN: 1,

  // Territory caps (must match claim_territory() RPC in migration 047)
  MAX_TERRITORIES_FREE: 50,
  MAX_TERRITORIES_PREMIUM: null as null, // unlimited for all paid tiers

  // Claim mechanic: time-in-hex
  CLAIM_TIME_IN_HEX_SEC: 60,

  LEVEL_XP: [0, 300, 800, 1800, 3500, 6000, 10000, 16000, 25000, 38000],
  LEVEL_TITLES: [
    'Scout', 'Pathfinder', 'Trailblazer', 'Ranger', 'Explorer',
    'Captain', 'Vanguard', 'Commander', 'Warlord', 'Legend',
  ],

  // Geography / run-processing
  METERS_PER_DEGREE_LAT:   111_320,    // ~1° latitude in metres at the equator
  MIN_CLAIM_DISTANCE_M:    200,        // minimum run distance to create a territory polygon
  CORRIDOR_BUFFER_M:       20,         // half-width of the territory corridor in metres
  MAX_GPS_SAMPLE_POINTS:   200,        // downsample limit before bufferPath
  MS_PER_DAY:              86_400_000, // milliseconds in 24 hours
} as const;
