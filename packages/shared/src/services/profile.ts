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
  /** 'race' and 'social' come from the v1 onboarding; the rest are older answers. */
  primaryGoal: 'get_fit' | 'race' | 'compete' | 'social' | 'lose_weight' | 'run_faster' | 'explore';
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
  weeklyGoalKm: number;
  missionDifficulty: 'easy' | 'mixed' | 'hard';
  onboardingCompletedAt: number;
  phone?: string;
  // v1 onboarding answers (profiles.usual_distance_km, recent_5k_seconds,
  // age_range, pacex_tone — migration 20261106000005)
  usualDistanceKm?: number;
  recentFiveKSeconds?: number | null;
  ageRange?: string | null;
  paceXTone?: 'encouraging' | 'structured' | 'competitive' | 'friendly';
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
