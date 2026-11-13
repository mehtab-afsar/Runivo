/**
 * Onboarding rules: validation and the mapping from a new runner's answers to
 * their starting setup (weekly target, mission difficulty, PaceX tone), plus
 * the login checks (phone, email, one-time-code resend limits).
 *
 * Pure functions only; tested in onboarding.test.ts.
 */

// ── Running goal ("Why do you run?") ─────────────────────────────────────────

export type RunningGoal = 'get_fit' | 'race' | 'compete' | 'social';
export type PaceXTone = 'encouraging' | 'structured' | 'competitive' | 'friendly';
export type ExperienceLevel = 'new' | 'casual' | 'regular' | 'competitive';
export type MissionDifficulty = 'easy' | 'mixed' | 'hard';
export type PreferredDistance = 'short' | '5k' | '10k' | 'long';

export const RUNNING_GOALS: { key: RunningGoal; label: string; sub: string }[] = [
  { key: 'get_fit', label: 'Get fit',          sub: 'Build the habit, feel better' },
  { key: 'race',    label: 'Train for a race', sub: 'A 5K, 10K, half or full' },
  { key: 'compete', label: 'Compete',          sub: 'Take ground, top the board' },
  { key: 'social',  label: 'Run with people',  sub: 'Clubs, friends, group runs' },
];

const TONE_BY_GOAL: Record<RunningGoal, PaceXTone> = {
  get_fit: 'encouraging',
  race:    'structured',
  compete: 'competitive',
  social:  'friendly',
};

/** How PaceX talks to this runner. */
export function paceXToneFor(goal: RunningGoal): PaceXTone {
  return TONE_BY_GOAL[goal];
}

// ── "Your running now" ───────────────────────────────────────────────────────

export const RUNS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const USUAL_DISTANCE_OPTIONS_KM = [2, 3, 5, 8, 10, 15, 21] as const;

/** Fastest and slowest 5K we accept (12:00 to 90:00). */
export const FIVE_K_MIN_S = 12 * 60;
export const FIVE_K_MAX_S = 90 * 60;

/**
 * Parses a 5K time typed as "mm:ss" (or "m:ss", or "h:mm:ss").
 * Empty input is fine (the field is optional) and returns { ok: true, seconds: null }.
 */
export function parseFiveKTime(input: string): { ok: true; seconds: number | null } | { ok: false; error: string } {
  const raw = input.trim();
  if (raw === '') return { ok: true, seconds: null };
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return { ok: false, error: 'Use minutes and seconds, like 27:30.' };
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (sec >= 60 || (m[1] && min >= 60)) return { ok: false, error: 'Use minutes and seconds, like 27:30.' };
  const seconds = h * 3600 + min * 60 + sec;
  if (seconds < FIVE_K_MIN_S) return { ok: false, error: 'That is faster than the 5K world record.' };
  if (seconds > FIVE_K_MAX_S) return { ok: false, error: 'Enter a time under 90 minutes, or leave it blank.' };
  return { ok: true, seconds };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function experienceLevelFor(runsPerWeek: number, usualKm: number, fiveKSeconds: number | null): ExperienceLevel {
  if (fiveKSeconds != null && fiveKSeconds < 20 * 60) return 'competitive';
  if (runsPerWeek >= 5 && usualKm >= 10) return 'competitive';
  if (runsPerWeek <= 1 || usualKm < 3) return 'new';
  if (runsPerWeek >= 4 || usualKm >= 8) return 'regular';
  return 'casual';
}

export function missionDifficultyFor(level: ExperienceLevel): MissionDifficulty {
  if (level === 'new') return 'easy';
  if (level === 'competitive') return 'hard';
  return 'mixed';
}

export function preferredDistanceFor(usualKm: number): PreferredDistance {
  if (usualKm < 4) return 'short';
  if (usualKm < 8) return '5k';
  if (usualKm < 13) return '10k';
  return 'long';
}

/**
 * Starting weekly target in km: what they already run, nudged up 10% for a
 * race goal, blended with the last 90 days from Apple Health / Health Connect
 * when they connected it. Between 3 and 120 km.
 */
export function startingWeeklyTargetKm(params: {
  runsPerWeek: number;
  usualKm: number;
  goal: RunningGoal;
  healthAvgWeeklyKm?: number | null;
}): number {
  const declared = Math.max(0, params.runsPerWeek) * Math.max(0, params.usualKm);
  const base = params.healthAvgWeeklyKm && params.healthAvgWeeklyKm > 0
    ? (declared + params.healthAvgWeeklyKm) / 2
    : declared;
  const withGoal = params.goal === 'race' ? base * 1.1 : base;
  return Math.min(120, Math.max(3, Math.round(withGoal)));
}

// ── Health import baseline ───────────────────────────────────────────────────

export interface HealthWorkoutLike {
  startTime: number;      // ms
  endTime: number;        // ms
  distanceMeters: number;
}

export interface HealthBaseline {
  runs: number;
  totalKm: number;
  avgWeeklyKm: number;
  runsPerWeek: number;
  longestKm: number;
  /** Time-weighted average pace, seconds per km. */
  avgPaceSecPerKm: number;
  days: number;
}

/** Runs only: at least 1 km, between 2:30 and 12:00 per km (drops walks and rides). */
const MIN_PACE_S = 150;
const MAX_PACE_S = 720;

/**
 * Summary of the last `days` days of imported workouts, for PaceX's baseline.
 * Past runs never claim zones; this only describes the runner.
 */
export function healthBaseline(workouts: HealthWorkoutLike[], nowMs: number, days = 90): HealthBaseline | null {
  const since = nowMs - days * 86_400_000;
  const runs = workouts.filter(w => {
    if (w.startTime < since || w.startTime > nowMs) return false;
    if (w.distanceMeters < 1000) return false;
    const pace = (w.endTime - w.startTime) / 1000 / (w.distanceMeters / 1000);
    return pace >= MIN_PACE_S && pace <= MAX_PACE_S;
  });
  if (runs.length === 0) return null;
  const totalKm = runs.reduce((s, r) => s + r.distanceMeters / 1000, 0);
  const totalSec = runs.reduce((s, r) => s + (r.endTime - r.startTime) / 1000, 0);
  const weeks = days / 7;
  return {
    runs: runs.length,
    totalKm: round1(totalKm),
    avgWeeklyKm: round1(totalKm / weeks),
    runsPerWeek: round1(runs.length / weeks),
    longestKm: round1(Math.max(...runs.map(r => r.distanceMeters / 1000))),
    avgPaceSecPerKm: Math.round(totalSec / totalKm),
    days,
  };
}

// ── About you (optional) ─────────────────────────────────────────────────────

export type AgeRange = 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_64' | '65_plus';

export const AGE_RANGES: { key: AgeRange; label: string; midpoint: number }[] = [
  { key: 'under_18', label: 'Under 18', midpoint: 16 },
  { key: '18_24',    label: '18–24',    midpoint: 21 },
  { key: '25_34',    label: '25–34',    midpoint: 30 },
  { key: '35_44',    label: '35–44',    midpoint: 40 },
  { key: '45_54',    label: '45–54',    midpoint: 50 },
  { key: '55_64',    label: '55–64',    midpoint: 60 },
  { key: '65_plus',  label: '65+',      midpoint: 70 },
];

/** The age used for calorie and heart-rate maths when only a range is given. */
export function ageForRange(range: AgeRange | null | undefined): number | null {
  if (!range) return null;
  return AGE_RANGES.find(a => a.key === range)?.midpoint ?? null;
}

// ── Username ─────────────────────────────────────────────────────────────────

const RESERVED = new Set(['admin', 'runivo', 'support', 'pacex', 'help', 'official', 'moderator', 'system']);

/** Lowercase letters, numbers and underscores, 3 to 20, starting with a letter. */
export function validateUsername(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = input.trim().toLowerCase();
  if (value.length < 3) return { ok: false, error: 'At least 3 characters.' };
  if (value.length > 20) return { ok: false, error: '20 characters at most.' };
  if (!/^[a-z]/.test(value)) return { ok: false, error: 'Start with a letter.' };
  if (!/^[a-z0-9_]+$/.test(value)) return { ok: false, error: 'Letters, numbers and underscores only.' };
  if (RESERVED.has(value)) return { ok: false, error: 'That name is reserved.' };
  return { ok: true, value };
}

// ── Login: phone, email, one-time codes ──────────────────────────────────────

/**
 * Normalises what someone typed into E.164 (+919876543210). A number without
 * a country code gets `defaultDialCode`; a leading trunk 0 is dropped; "00"
 * becomes "+".
 */
export function normalizePhone(input: string, defaultDialCode = '+91'): { ok: true; e164: string } | { ok: false; error: string } {
  let s = input.replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    s = s.replace(/^0+/, '');
    s = defaultDialCode + s;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return { ok: false, error: 'Enter a valid mobile number.' };
  return { ok: true, e164: s };
}

export function validateEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export const OTP_RESEND_COOLDOWN_S = 30;
export const OTP_MAX_RESENDS = 3;
export const OTP_WINDOW_MS = 10 * 60_000;

/**
 * Whether another code may be sent now. `sentAt` holds the times codes were
 * sent (the first send plus any resends). After a send you wait 30 s; within
 * any 10 minutes you get the first code plus 3 resends.
 */
export function otpSendPolicy(sentAt: number[], nowMs: number): { allowed: boolean; waitSeconds: number; resendsLeft: number } {
  const recent = sentAt.filter(t => nowMs - t < OTP_WINDOW_MS).sort((a, b) => a - b);
  const resendsUsed = Math.max(0, recent.length - 1);
  const resendsLeft = Math.max(0, OTP_MAX_RESENDS - resendsUsed);
  if (recent.length === 0) return { allowed: true, waitSeconds: 0, resendsLeft };
  const last = recent[recent.length - 1];
  const cooldownLeft = Math.ceil((last + OTP_RESEND_COOLDOWN_S * 1000 - nowMs) / 1000);
  if (resendsLeft === 0) {
    const windowLeft = Math.ceil((recent[0] + OTP_WINDOW_MS - nowMs) / 1000);
    return { allowed: false, waitSeconds: Math.max(0, windowLeft), resendsLeft };
  }
  if (cooldownLeft > 0) return { allowed: false, waitSeconds: cooldownLeft, resendsLeft };
  return { allowed: true, waitSeconds: 0, resendsLeft };
}

export function isOtpCode(input: string): boolean {
  return /^\d{6}$/.test(input);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
