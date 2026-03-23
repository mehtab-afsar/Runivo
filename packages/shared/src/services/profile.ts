import { getDB } from './store';

export interface PlayerProfile {
  playerId: string;
  // Biometrics — used for calorie & pace calculations
  age: number;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: number;
  weightKg: number;
  // Training preferences
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  weeklyFrequency: number;
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
  weeklyGoalKm: number;
  missionDifficulty: 'easy' | 'mixed' | 'hard';
  onboardingCompletedAt: number;
  phone?: string;
  playstyle?: 'conqueror' | 'defender' | 'explorer' | 'social'; // kept for DB compat
}

const STORE_NAME = 'profile';

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, profile);
}

export async function getProfile(): Promise<PlayerProfile | undefined> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all[0] as PlayerProfile | undefined;
}

export function computeWeeklyGoal(frequency: number, distance: PlayerProfile['preferredDistance']): number {
  const distMap: Record<string, number> = { short: 2, '5k': 4, '10k': 7.5, long: 12 };
  return Math.round(frequency * (distMap[distance] || 4));
}
