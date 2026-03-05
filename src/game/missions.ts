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
    gems?: number;
  };
  expiresAt: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const MISSION_TEMPLATES: Omit<Mission, 'id' | 'current' | 'completed' | 'claimed' | 'expiresAt'>[] = [
  // Easy
  {
    type: 'run_distance',
    title: 'Morning Miles',
    description: 'Run a total of 1 km today',
    icon: '\u{1F3C3}',
    target: 1,
    rewards: { xp: 30, coins: 15 },
    difficulty: 'easy',
  },
  {
    type: 'claim_territories',
    title: 'Land Grab',
    description: 'Claim 1 new territory',
    icon: '\u{1F3F4}',
    target: 1,
    rewards: { xp: 40, coins: 20 },
    difficulty: 'easy',
  },
  {
    type: 'fortify_territories',
    title: 'Shore Up Defenses',
    description: 'Fortify 2 of your territories',
    icon: '\u{1F6E1}\uFE0F',
    target: 2,
    rewards: { xp: 35, coins: 15 },
    difficulty: 'easy',
  },
  {
    type: 'explore_new_hexes',
    title: 'Explorer',
    description: 'Run through 5 different hexes',
    icon: '\u{1F9ED}',
    target: 5,
    rewards: { xp: 25, coins: 10 },
    difficulty: 'easy',
  },
  // Medium
  {
    type: 'run_distance',
    title: 'Push Further',
    description: 'Run a total of 3 km today',
    icon: '\u{1F525}',
    target: 3,
    rewards: { xp: 80, coins: 40 },
    difficulty: 'medium',
  },
  {
    type: 'claim_territories',
    title: 'Territorial',
    description: 'Claim 3 territories in one session',
    icon: '\u26A1',
    target: 3,
    rewards: { xp: 100, coins: 50 },
    difficulty: 'medium',
  },
  {
    type: 'capture_enemy',
    title: 'Hostile Takeover',
    description: 'Capture 1 enemy territory',
    icon: '\u2694\uFE0F',
    target: 1,
    rewards: { xp: 75, coins: 35 },
    difficulty: 'medium',
  },
  {
    type: 'run_in_enemy_zone',
    title: 'Behind Enemy Lines',
    description: 'Run 500m through enemy territory',
    icon: '\u{1F3AF}',
    target: 0.5,
    rewards: { xp: 60, coins: 30 },
    difficulty: 'medium',
  },
  {
    type: 'speed_run',
    title: 'Speed Demon',
    description: 'Maintain pace under 6:00/km for 1 km',
    icon: '\u{1F4A8}',
    target: 1,
    rewards: { xp: 70, coins: 35 },
    difficulty: 'medium',
  },
  // Hard
  {
    type: 'run_distance',
    title: 'Endurance Test',
    description: 'Run 5 km in a single session',
    icon: '\u{1F3C6}',
    target: 5,
    rewards: { xp: 200, coins: 100, gems: 2 },
    difficulty: 'hard',
  },
  {
    type: 'claim_territories',
    title: 'Empire Builder',
    description: 'Claim 5 territories today',
    icon: '\u{1F451}',
    target: 5,
    rewards: { xp: 250, coins: 120, gems: 3 },
    difficulty: 'hard',
  },
  {
    type: 'capture_enemy',
    title: 'War Machine',
    description: 'Capture 3 enemy territories in one run',
    icon: '\u{1F480}',
    target: 3,
    rewards: { xp: 300, coins: 150, gems: 5 },
    difficulty: 'hard',
  },
];

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
