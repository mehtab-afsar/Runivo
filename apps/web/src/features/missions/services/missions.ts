export type GoalCategory = 'weight_loss' | 'endurance' | 'speed' | 'territory' | 'explorer' | 'all';

export type MissionType =
  | 'claim_territories'
  | 'run_distance'
  | 'run_in_enemy_zone'
  | 'fortify_territories'
  | 'run_streak'
  | 'capture_enemy'
  | 'speed_run'
  | 'explore_new_hexes';

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
  rewards: {
    xp: number;
    coins: number;
  };
  expiresAt: number;
  difficulty: 'easy' | 'medium' | 'hard';
  goalCategory?: GoalCategory;
}

export const MISSION_TEMPLATES: Omit<Mission, 'id' | 'current' | 'completed' | 'claimed' | 'expiresAt'>[] = [
  // Easy
  {
    type: 'run_distance',
    title: 'Morning Miles',
    description: 'Run a total of 1 km today',
    icon: '🏃',
    target: 1,
    rewards: { xp: 30, coins: 15 },
    difficulty: 'easy',
    goalCategory: 'endurance',
  },
  {
    type: 'claim_territories',
    title: 'Land Grab',
    description: 'Claim 1 new territory',
    icon: '🏴',
    target: 1,
    rewards: { xp: 40, coins: 20 },
    difficulty: 'easy',
    goalCategory: 'territory',
  },
  {
    type: 'fortify_territories',
    title: 'Shore Up Defenses',
    description: 'Fortify 2 of your territories',
    icon: '🛡️',
    target: 2,
    rewards: { xp: 35, coins: 15 },
    difficulty: 'easy',
    goalCategory: 'territory',
  },
  {
    type: 'explore_new_hexes',
    title: 'Explorer',
    description: 'Run through 5 different hexes',
    icon: '🧭',
    target: 5,
    rewards: { xp: 25, coins: 10 },
    difficulty: 'easy',
    goalCategory: 'explorer',
  },
  // Easy — Weight Loss
  {
    type: 'run_distance',
    title: 'Calorie Crusher',
    description: 'Run 2 km to torch calories and kickstart your metabolism',
    icon: '🔥',
    target: 2,
    rewards: { xp: 55, coins: 25 },
    difficulty: 'easy',
    goalCategory: 'weight_loss',
  },
  // Easy — Endurance
  {
    type: 'run_distance',
    title: 'Steady State',
    description: 'Run 1.5 km at a comfortable, sustained pace',
    icon: '💪',
    target: 1.5,
    rewards: { xp: 45, coins: 20 },
    difficulty: 'easy',
    goalCategory: 'endurance',
  },
  // Medium
  {
    type: 'run_distance',
    title: 'Push Further',
    description: 'Run a total of 3 km today',
    icon: '🔥',
    target: 3,
    rewards: { xp: 80, coins: 40 },
    difficulty: 'medium',
    goalCategory: 'endurance',
  },
  {
    type: 'claim_territories',
    title: 'Territorial',
    description: 'Claim 3 territories in one session',
    icon: '⚡',
    target: 3,
    rewards: { xp: 100, coins: 50 },
    difficulty: 'medium',
    goalCategory: 'territory',
  },
  {
    type: 'capture_enemy',
    title: 'Hostile Takeover',
    description: 'Capture 1 enemy territory',
    icon: '⚔️',
    target: 1,
    rewards: { xp: 75, coins: 35 },
    difficulty: 'medium',
    goalCategory: 'territory',
  },
  {
    type: 'run_in_enemy_zone',
    title: 'Behind Enemy Lines',
    description: 'Run 500m through enemy territory',
    icon: '🎯',
    target: 0.5,
    rewards: { xp: 60, coins: 30 },
    difficulty: 'medium',
    goalCategory: 'territory',
  },
  {
    type: 'speed_run',
    title: 'Speed Demon',
    description: 'Maintain pace under 6:00/km for 1 km',
    icon: '💨',
    target: 1,
    rewards: { xp: 70, coins: 35 },
    difficulty: 'medium',
    goalCategory: 'speed',
  },
  // Medium — Weight Loss
  {
    type: 'run_distance',
    title: 'Fat Burn Zone',
    description: 'Complete a 4 km steady-state run in the fat-burning zone',
    icon: '💧',
    target: 4,
    rewards: { xp: 120, coins: 60 },
    difficulty: 'medium',
    goalCategory: 'weight_loss',
  },
  // Medium — Explorer
  {
    type: 'explore_new_hexes',
    title: 'Off The Beaten Path',
    description: 'Discover 10 new map hexes you have never visited',
    icon: '🗺️',
    target: 10,
    rewards: { xp: 150, coins: 85 },
    difficulty: 'medium',
    goalCategory: 'explorer',
  },
  // Hard
  {
    type: 'run_distance',
    title: 'Endurance Test',
    description: 'Run 5 km in a single session',
    icon: '🏆',
    target: 5,
    rewards: { xp: 200, coins: 120 },
    difficulty: 'hard',
    goalCategory: 'endurance',
  },
  {
    type: 'claim_territories',
    title: 'Empire Builder',
    description: 'Claim 5 territories today',
    icon: '👑',
    target: 5,
    rewards: { xp: 250, coins: 150 },
    difficulty: 'hard',
    goalCategory: 'territory',
  },
  {
    type: 'capture_enemy',
    title: 'War Machine',
    description: 'Capture 3 enemy territories in one run',
    icon: '💀',
    target: 3,
    rewards: { xp: 300, coins: 200 },
    difficulty: 'hard',
    goalCategory: 'territory',
  },
  // Hard — Endurance
  {
    type: 'run_distance',
    title: 'Long Haul',
    description: 'Run 8 km to build serious aerobic base',
    icon: '🏅',
    target: 8,
    rewards: { xp: 280, coins: 170 },
    difficulty: 'hard',
    goalCategory: 'endurance',
  },
  // Hard — Speed
  {
    type: 'speed_run',
    title: 'Sprint Intervals',
    description: 'Complete 3 km with sub-5:30/km pace to build top-end speed',
    icon: '🚀',
    target: 3,
    rewards: { xp: 180, coins: 110 },
    difficulty: 'hard',
    goalCategory: 'speed',
  },
];

export const GOAL_TO_CATEGORY: Record<'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete', GoalCategory> = {
  lose_weight: 'weight_loss',
  run_faster: 'speed',
  get_fit: 'endurance',
  explore: 'explorer',
  compete: 'territory',
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateDailyMissions(date: Date = new Date()): Mission[] {
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const seed = Array.from(dayKey).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();

  const easy = MISSION_TEMPLATES.filter(m => m.difficulty === 'easy');
  const medium = MISSION_TEMPLATES.filter(m => m.difficulty === 'medium');
  const hard = MISSION_TEMPLATES.filter(m => m.difficulty === 'hard');

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const difficulty = localStorage.getItem('runivo-mission-difficulty') || 'mixed';
  let selected;
  if (difficulty === 'easy') {
    selected = [pick(easy), pick(easy), pick(medium)];
  } else if (difficulty === 'hard') {
    selected = [pick(medium), pick(hard), pick(hard)];
  } else {
    selected = [pick(easy), pick(medium), pick(hard)];
  }

  return selected.map((template, i) => ({
    ...template,
    id: `daily-${dayKey}-${i}`,
    current: 0,
    completed: false,
    claimed: false,
    expiresAt,
  }));
}

export function generateBlueprint(
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete',
  missionDifficulty: 'easy' | 'mixed' | 'hard' = 'mixed',
  date: Date = new Date()
): Mission[] {
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const seedStr = dayKey + primaryGoal + '-bp';
  const seed = Array.from(seedStr).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();

  const goalCat = GOAL_TO_CATEGORY[primaryGoal];

  const pickBiased = (pool: typeof MISSION_TEMPLATES): typeof MISSION_TEMPLATES[0] => {
    const preferred = pool.filter(m => m.goalCategory === goalCat);
    // 70% chance pick from goal-matching, 30% from full pool
    const usePreferred = preferred.length > 0 && rand() < 0.7;
    const source = usePreferred ? preferred : pool;
    return source[Math.floor(rand() * source.length)];
  };

  const easy = MISSION_TEMPLATES.filter(m => m.difficulty === 'easy');
  const medium = MISSION_TEMPLATES.filter(m => m.difficulty === 'medium');
  const hard = MISSION_TEMPLATES.filter(m => m.difficulty === 'hard');

  let slots: typeof MISSION_TEMPLATES;
  if (missionDifficulty === 'easy') {
    slots = [pickBiased(easy), pickBiased(easy), pickBiased(medium)];
  } else if (missionDifficulty === 'hard') {
    slots = [pickBiased(medium), pickBiased(hard), pickBiased(hard)];
  } else {
    slots = [pickBiased(easy), pickBiased(medium), pickBiased(hard)];
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const deduped: typeof MISSION_TEMPLATES = [];
  for (const m of slots) {
    if (!seen.has(m.title)) {
      seen.add(m.title);
      deduped.push(m);
    }
  }
  // If we had duplicates, fill from remaining templates
  const allByDiff = (missionDifficulty === 'easy'
    ? [...easy, ...medium]
    : missionDifficulty === 'hard'
    ? [...medium, ...hard]
    : [...easy, ...medium, ...hard]);
  let fillIdx = 0;
  while (deduped.length < 3) {
    const candidate = allByDiff[fillIdx % allByDiff.length];
    fillIdx++;
    if (!seen.has(candidate.title)) {
      seen.add(candidate.title);
      deduped.push(candidate);
    }
    if (fillIdx > allByDiff.length * 2) break;
  }

  return deduped.slice(0, 3).map((template, i) => ({
    ...template,
    id: `blueprint-${dayKey}-${i}`,
    current: 0,
    completed: false,
    claimed: false,
    expiresAt,
  }));
}

export function updateMissionProgress(
  missions: Mission[],
  runResult: {
    distanceKm: number;
    territoriesClaimed: string[];
    territoriesFortified: string[];
    enemyCaptured: number;
    hexesVisited: number;
    enemyZoneDistanceKm: number;
    fastKmCount: number;
  }
): Mission[] {
  return missions.map(mission => {
    if (mission.completed) return mission;

    let newCurrent = mission.current;

    switch (mission.type) {
      case 'run_distance':
        newCurrent += runResult.distanceKm;
        break;
      case 'claim_territories':
        newCurrent += runResult.territoriesClaimed.length;
        break;
      case 'fortify_territories':
        newCurrent += runResult.territoriesFortified.length;
        break;
      case 'capture_enemy':
        newCurrent += runResult.enemyCaptured;
        break;
      case 'explore_new_hexes':
        newCurrent += runResult.hexesVisited;
        break;
      case 'run_in_enemy_zone':
        newCurrent += runResult.enemyZoneDistanceKm;
        break;
      case 'speed_run':
        newCurrent += runResult.fastKmCount;
        break;
    }

    const completed = newCurrent >= mission.target;

    return {
      ...mission,
      current: Math.min(newCurrent, mission.target),
      completed,
    };
  });
}
