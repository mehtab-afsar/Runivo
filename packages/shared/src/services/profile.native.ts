/**
 * Native (expo-sqlite) implementation of profile storage.
 * Metro automatically picks this file on iOS/Android; Vite picks profile.ts on web.
 * Profile data is stored in the settings table with key 'player_profile'.
 *
 * NOTE: Do NOT import from './profile' here — Metro resolves './profile' back to
 * this file (native ext priority), creating a circular self-import that blows
 * Hermes's call stack. All shared types/functions are inlined below.
 */
import * as SQLite from 'expo-sqlite';

// ── Inlined from profile.ts (cannot import to avoid self-cycle) ──────────────
export interface PlayerProfile {
  playerId: string;
  age: number;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: number;
  weightKg: number;
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
  // v1 onboarding answers (migration 20261106000005)
  usualDistanceKm?: number;
  recentFiveKSeconds?: number | null;
  ageRange?: string | null;
  paceXTone?: 'encouraging' | 'structured' | 'competitive' | 'friendly';
  playstyle?: 'conqueror' | 'defender' | 'explorer' | 'social';
}

export function computeWeeklyGoal(
  frequency: number,
  distance: PlayerProfile['preferredDistance'],
): number {
  const distMap: Record<string, number> = { short: 2, '5k': 4, '10k': 7.5, long: 12 };
  return Math.round(frequency * (distMap[distance] || 4));
}
// ─────────────────────────────────────────────────────────────────────────────

const _db = SQLite.openDatabaseSync('runivo.db');

async function ensureTable(): Promise<void> {
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await ensureTable();
  _db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'player_profile',
    JSON.stringify(profile),
  );
}

export async function getProfile(): Promise<PlayerProfile | undefined> {
  await ensureTable();
  const row = _db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'player_profile'",
  );
  if (!row) return undefined;
  return JSON.parse(row.value) as PlayerProfile;
}
