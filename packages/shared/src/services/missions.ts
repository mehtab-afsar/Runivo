// Mobile-native copy of mission types and logic.
// Key difference from web: generateDailyMissions accepts a difficulty param
// instead of reading from localStorage.

export type GoalCategory = 'weight_loss' | 'endurance' | 'speed' | 'territory' | 'explorer' | 'all' | 'health';

export type MissionType =
  | 'claim_territories'
  | 'run_distance'
  | 'run_streak'
  | 'capture_enemy'
  | 'speed_run'
  | 'defend_zone'
  | 'steal_rival'
  | 'nutrition_streak';

export interface Mission {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  icon: string;
  target: number;
  current: number;
  completed: boolean;
  claimed: boolean;
  rewards: { pace: number };
  expiresAt: number;
  difficulty: 'easy' | 'medium' | 'hard';
  goalCategory?: GoalCategory;
}

// Shown as a small caption under a mission's title wherever it's displayed —
// the mission engine genuinely watches real runs/meals, but nothing in the UI
// said so, which reads identically to a static mock. Keyed by MissionType so
// it stays in sync with whatever ACTIVE_MISSION_TEMPLATES currently offers.
export const MISSION_SOURCE_LABEL: Record<MissionType, string> = {
  run_distance:      'Run · updates after each run',
  claim_territories: 'Run · updates after each run',
  run_streak:        'Run · streak-based',
  nutrition_streak:  'Nutrition · streak-based',
  capture_enemy:     'Run · territory combat',
  speed_run:         'Run · pace-based',
  defend_zone:       'Run · territory combat',
  steal_rival:       'Run · territory combat',
};

export const MISSION_TEMPLATES: Omit<Mission, 'id' | 'current' | 'completed' | 'claimed' | 'expiresAt'>[] = [
  { type: 'run_distance',      title: 'Morning Miles',    description: 'Run a total of 1 km today',                    icon: '🏃', target: 1,   rewards: { pace: 4  }, difficulty: 'easy',   goalCategory: 'endurance'   },
  { type: 'claim_territories', title: 'Land Grab',        description: 'Claim 1 new territory',                        icon: '🏴', target: 1,   rewards: { pace: 5  }, difficulty: 'easy',   goalCategory: 'territory'   },
  { type: 'run_distance',      title: 'Calorie Crusher',  description: 'Run 2 km to torch calories',                   icon: '🔥', target: 2,   rewards: { pace: 7  }, difficulty: 'easy',   goalCategory: 'weight_loss' },
  { type: 'run_distance',      title: 'Steady State',     description: 'Run 1.5 km at a comfortable, sustained pace',  icon: '💪', target: 1.5, rewards: { pace: 6  }, difficulty: 'easy',   goalCategory: 'endurance'   },
  { type: 'run_distance',      title: 'Push Further',     description: 'Run a total of 3 km today',                    icon: '🔥', target: 3,   rewards: { pace: 10 }, difficulty: 'medium', goalCategory: 'endurance'   },
  { type: 'claim_territories', title: 'Territorial',      description: 'Claim 3 territories today',                    icon: '⚡', target: 3,   rewards: { pace: 12 }, difficulty: 'medium', goalCategory: 'territory'   },
  { type: 'capture_enemy',     title: 'Hostile Takeover', description: 'Capture 1 enemy territory',                    icon: '⚔️', target: 1,   rewards: { pace: 8  }, difficulty: 'medium', goalCategory: 'territory'   },
  { type: 'speed_run',         title: 'Speed Demon',      description: 'Maintain pace under 6:00/km for 1 km',         icon: '💨', target: 1,   rewards: { pace: 9  }, difficulty: 'medium', goalCategory: 'speed'       },
  { type: 'run_distance',      title: 'Fat Burn Zone',    description: 'Complete a 4 km steady-state run',             icon: '💧', target: 4,   rewards: { pace: 15 }, difficulty: 'medium', goalCategory: 'weight_loss' },
  { type: 'defend_zone',       title: 'Defend Your Turf', description: 'Re-run through one of your stale zones to refresh it', icon: '🛡', target: 1, rewards: { pace: 20 }, difficulty: 'medium', goalCategory: 'territory'   },
  { type: 'run_distance',      title: 'Endurance Test',   description: 'Run 5 km today',                               icon: '🏆', target: 5,   rewards: { pace: 25 }, difficulty: 'hard',   goalCategory: 'endurance'   },
  { type: 'claim_territories', title: 'Empire Builder',   description: 'Claim 5 territories today',                    icon: '👑', target: 5,   rewards: { pace: 30 }, difficulty: 'hard',   goalCategory: 'territory'   },
  { type: 'capture_enemy',     title: 'War Machine',      description: 'Capture 3 enemy territories today',            icon: '💀', target: 3,   rewards: { pace: 40 }, difficulty: 'hard',   goalCategory: 'territory'   },
  { type: 'run_distance',      title: 'Long Haul',        description: 'Run 8 km to build serious aerobic base',       icon: '🏅', target: 8,   rewards: { pace: 35 }, difficulty: 'hard',   goalCategory: 'endurance'   },
  { type: 'speed_run',         title: 'Sprint Intervals', description: 'Complete 3 km with sub-5:30/km pace',          icon: '🚀', target: 3,   rewards: { pace: 22 }, difficulty: 'hard',   goalCategory: 'speed'       },
  { type: 'steal_rival',       title: 'Take Their Ground', description: 'Capture part of a rival\'s territory on your run', icon: '⚔️', target: 1, rewards: { pace: 30 }, difficulty: 'hard',  goalCategory: 'territory'   },
  { type: 'nutrition_streak',  title: 'Fuel Right',        description: 'Log at least 3 meals per day for 5 days this week', icon: '🥗', target: 5, rewards: { pace: 15 }, difficulty: 'medium', goalCategory: 'health' },
  { type: 'run_distance',      title: 'New Route',        description: 'Run 1.5 km — take a street you don\'t usually run', icon: '🧭', target: 1.5, rewards: { pace: 6  }, difficulty: 'easy',   goalCategory: 'explorer'    },
  { type: 'claim_territories', title: 'Chart New Ground', description: 'Claim 2 new territories',                      icon: '🗺️', target: 2,   rewards: { pace: 9  }, difficulty: 'medium', goalCategory: 'explorer'    },
];

// Mission types with no real, verifiable progress signal today: useGameEngine.ts's
// endRunSession() hardcodes enemyCaptured/fastKmCount/defendedZonesCount/rivalZonesStolen
// to 0 on every run (fastKmCount has no tracking anywhere, client or server; the other
// three ARE eventually known — process-run-territory resolves them server-side — but
// never get fed back into mission progress). A mission of one of these types can never
// reach its target through legitimate play. Anything user-facing (daily generation, the
// blueprint, the manual picker) must draw from ACTIVE_MISSION_TEMPLATES, not the full
// catalogue, until real tracking exists — remove an entry here once it does.
const UNTRACKED_MISSION_TYPES = new Set<MissionType>(['capture_enemy', 'speed_run', 'defend_zone', 'steal_rival']);
export const ACTIVE_MISSION_TEMPLATES = MISSION_TEMPLATES.filter(m => !UNTRACKED_MISSION_TYPES.has(m.type));

export const GOAL_TO_CATEGORY: Record<'get_fit' | 'race' | 'social' | 'lose_weight' | 'run_faster' | 'explore' | 'compete', GoalCategory> = {
  // v1 onboarding goals: race training leans on pace work, running with
  // people on routes worth sharing.
  race:        'speed',
  social:      'explorer',
  lose_weight: 'weight_loss',
  run_faster:  'speed',
  get_fit:     'endurance',
  explore:     'explorer',
  compete:     'territory',
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateDailyMissions(
  date: Date = new Date(),
  difficulty: 'easy' | 'mixed' | 'hard' = 'mixed',
): Mission[] {
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const seed = Array.from(dayKey).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();

  const easy   = ACTIVE_MISSION_TEMPLATES.filter(m => m.difficulty === 'easy');
  const medium = ACTIVE_MISSION_TEMPLATES.filter(m => m.difficulty === 'medium');
  const hard   = ACTIVE_MISSION_TEMPLATES.filter(m => m.difficulty === 'hard');

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  let selected: typeof MISSION_TEMPLATES;
  if (difficulty === 'easy') {
    selected = [pick(easy), pick(easy), pick(medium)];
  } else if (difficulty === 'hard') {
    selected = [pick(medium), pick(hard), pick(hard)];
  } else {
    selected = [pick(easy), pick(medium), pick(hard)];
  }

  return selected.map((template, i) => ({
    ...template,
    id:        `daily-${dayKey}-${i}`,
    current:   0,
    completed: false,
    claimed:   false,
    expiresAt,
  }));
}

export function generateBlueprint(
  primaryGoal: keyof typeof GOAL_TO_CATEGORY,
  missionDifficulty: 'easy' | 'mixed' | 'hard' = 'mixed',
  date: Date = new Date(),
): Mission[] {
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const seedStr = dayKey + primaryGoal + '-bp';
  const seed = Array.from(seedStr).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();
  const goalCat = GOAL_TO_CATEGORY[primaryGoal];
  const pickBiased = (pool: typeof ACTIVE_MISSION_TEMPLATES): typeof ACTIVE_MISSION_TEMPLATES[0] => {
    const preferred = pool.filter(m => m.goalCategory === goalCat);
    const usePreferred = preferred.length > 0 && rand() < 0.7;
    const source = usePreferred ? preferred : pool;
    return source[Math.floor(rand() * source.length)];
  };
  const easy   = ACTIVE_MISSION_TEMPLATES.filter(m => m.difficulty === 'easy');
  const medium = ACTIVE_MISSION_TEMPLATES.filter(m => m.difficulty === 'medium');
  const hard   = ACTIVE_MISSION_TEMPLATES.filter(m => m.difficulty === 'hard');
  let slots: typeof ACTIVE_MISSION_TEMPLATES;
  if (missionDifficulty === 'easy') {
    slots = [pickBiased(easy), pickBiased(easy), pickBiased(medium)];
  } else if (missionDifficulty === 'hard') {
    slots = [pickBiased(medium), pickBiased(hard), pickBiased(hard)];
  } else {
    slots = [pickBiased(easy), pickBiased(medium), pickBiased(hard)];
  }
  const seen = new Set<string>();
  const deduped: typeof ACTIVE_MISSION_TEMPLATES = [];
  for (const m of slots) {
    if (!seen.has(m.title)) { seen.add(m.title); deduped.push(m); }
  }
  const allByDiff = missionDifficulty === 'easy'
    ? [...easy, ...medium]
    : missionDifficulty === 'hard'
    ? [...medium, ...hard]
    : [...easy, ...medium, ...hard];
  let fillIdx = 0;
  while (deduped.length < 3) {
    const candidate = allByDiff[fillIdx % allByDiff.length];
    fillIdx++;
    if (!seen.has(candidate.title)) { seen.add(candidate.title); deduped.push(candidate); }
    if (fillIdx > allByDiff.length * 2) break;
  }
  return deduped.slice(0, 3).map((template, i) => ({
    ...template,
    id: `blueprint-${dayKey}-${i}`,
    current:   0,
    completed: false,
    claimed:   false,
    expiresAt,
  }));
}

// ── Training-plan → mission bridge ──────────────────────────────────────────
// Missions only ever represent "today" — there's no forward-scheduling concept
// in this system (generateDailyMissions regenerates from scratch every day,
// keyed by date). A multi-week training_plans row can't be represented here
// wholesale, so this only ever surfaces the ONE session actually due today,
// as one of today's missions, rather than pretending the whole week fits.
export interface PlanSession {
  day:         string;
  type:        string;
  description: string;
}

const PLAN_SESSION_DEFAULT_KM: Record<string, number> = {
  'Easy Run': 3,
  'Tempo':    3,
  'Long Run': 6,
};

/**
 * Builds a run_distance mission from today's scheduled plan session, so a
 * plan someone's actually following shows up as today's mission instead of
 * an unrelated random pick. Returns null for a Rest day — nothing to turn
 * into a mission.
 *
 * Target distance is parsed from the session's own description ("5km at
 * ...") when present — the format handleTrainingPlan's prompt asks Claude to
 * use — falling back to a type-based default since not every description
 * follows it (the edge function's own parse-failure fallback plan phrases
 * Tempo in minutes, not km).
 */
export function missionFromPlanSession(session: PlanSession, expiresAt: number): Omit<Mission, 'id'> | null {
  if (session.type === 'Rest') return null;
  const match    = session.description.match(/(\d+(?:\.\d+)?)\s*km/i);
  const targetKm = match ? parseFloat(match[1]) : (PLAN_SESSION_DEFAULT_KM[session.type] ?? 3);
  return {
    type:        'run_distance',
    title:       session.type,
    description: session.description,
    icon:        '📅',
    target:      targetKm,
    current:     0,
    completed:   false,
    claimed:     false,
    // Roughly matches ACTIVE_MISSION_TEMPLATES' existing run_distance scaling
    // (1km → 4 PACE, 3km → ~10-12, 8km → 35) rather than a fixed flat reward.
    rewards:     { pace: Math.max(4, Math.round(targetKm * 4)) },
    expiresAt,
    difficulty:  targetKm >= 6 ? 'hard' : targetKm >= 3 ? 'medium' : 'easy',
  };
}

export function updateMissionProgress(
  missions: Mission[],
  runResult: {
    distanceKm:          number;
    territoriesClaimed:  string[];
    enemyCaptured:       number;
    fastKmCount:         number;
    defendedZonesCount:  number;
    rivalZonesStolen:    number;
  },
): Mission[] {
  return missions.map(mission => {
    if (mission.completed) return mission;

    let newCurrent = mission.current;

    switch (mission.type) {
      case 'run_distance':      newCurrent += runResult.distanceKm; break;
      case 'claim_territories': newCurrent += runResult.territoriesClaimed.length; break;
      case 'capture_enemy':     newCurrent += runResult.enemyCaptured; break;
      case 'speed_run':         newCurrent += runResult.fastKmCount; break;
      case 'defend_zone':       newCurrent += runResult.defendedZonesCount; break;
      case 'steal_rival':       newCurrent += runResult.rivalZonesStolen; break;
      case 'nutrition_streak':  break; // updated by updateMissionsAfterNutritionLog
    }

    const completed = newCurrent >= mission.target;
    return { ...mission, current: Math.min(newCurrent, mission.target), completed };
  });
}
