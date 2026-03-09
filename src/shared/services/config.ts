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

  // XP & coins
  XP_CLAIM_NEUTRAL: 25,
  XP_CLAIM_ENEMY: 60,
  XP_PER_KM: 30,
  XP_FORTIFY: 10,
  COINS_CLAIM_NEUTRAL: 10,
  COINS_CLAIM_ENEMY: 25,
  COINS_PER_KM: 5,
  BASE_INCOME_PER_HEX_DAY: 5,

  // Speed multiplier (PRD Part 2)
  SPEED_BONUS_THRESHOLD_MPS: 3.5,
  SPEED_BONUS_MULTIPLIER: 1.4,

  // Energy
  MAX_ENERGY: 100,
  ENERGY_REGEN_PER_HOUR: 10,
  ENERGY_COST_CLAIM: 10,        // energy spent per territory claimed
  ENERGY_REGEN_PER_KM_RUN: 10, // energy restored per km run in real-time during a run
  ENERGY_COST_SHIELD: 30,
  ENERGY_COST_BOOST: 20,
  ENERGY_COST_SCAN: 10,

  // Territory caps (PRD Part 3)
  MAX_TERRITORIES_FREE: 20,
  TERRITORY_BONUS_LVL5: 2,
  TERRITORY_BONUS_LVL10: 5,
  TERRITORY_BONUS_LVL17: 10,
  MAX_TERRITORIES_PREMIUM: 100,

  // Diamond milestones (PRD Part 4)
  DIAMONDS_STREAK_7: 3,
  DIAMONDS_STREAK_30: 10,
  DIAMONDS_STREAK_100: 25,
  DIAMONDS_LEVELUP_MILESTONE: [5, 10, 15, 20] as const,
  DIAMONDS_LEVELUP_AMOUNTS: [2, 5, 10, 20] as const,

  LEVEL_XP: [
    0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500,
    8500, 11000, 14000, 17500, 22000, 27000, 33000, 40000, 48000, 58000,
  ],
  LEVEL_TITLES: [
    'Scout', 'Pathfinder', 'Trailblazer', 'Ranger', 'Explorer',
    'Captain', 'Vanguard', 'Commander', 'Warlord', 'General',
    'Conqueror', 'Overlord', 'Sovereign', 'Emperor', 'Titan',
    'Mythic', 'Immortal', 'Transcendent', 'Apex', 'Legend',
  ],
} as const;
