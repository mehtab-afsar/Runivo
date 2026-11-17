import type { RunningGoal, AgeRange, HealthBaseline, PaceXTone } from '@shared/engine/onboarding';
import type { RaceDistance } from '@shared/engine/training';

/**
 * Onboarding (welcome and sign-in come first, on their own screens). Optional
 * steps can be skipped. Week, body and coach feed PaceX and plan setup; the
 * race itself is picked in plan setup, which opens when onboarding ends.
 */
export const ONBOARDING_STEPS = [
  { key: 'location',      label: 'Your area',    optional: false },
  { key: 'goal',          label: 'Your goal',    optional: false },
  { key: 'running',       label: 'Your running', optional: false },
  { key: 'week',          label: 'Your week',    optional: true },
  { key: 'body',          label: 'Your body',    optional: true },
  { key: 'coach',         label: 'PaceX voice',  optional: true },
  { key: 'health',        label: 'Health app',   optional: true },
  { key: 'watch',         label: 'Your watch',   optional: true },
  { key: 'about',         label: 'About you',    optional: true },
  { key: 'identity',      label: 'Your name',    optional: false },
  { key: 'people',        label: 'Your people',  optional: true },
  { key: 'notifications', label: 'Alerts',       optional: true },
  { key: 'mission',       label: 'First run',    optional: false },
] as const;

export type OnboardingStepKey = typeof ONBOARDING_STEPS[number]['key'];

/**
 * O4: half of new runners get the short path, without Health and About you
 * (both stay in Settings). Compare run-within-24h per variant with
 * onboarding_activation() before keeping one.
 */
export type OnboardingVariant = 'full' | 'short';
export const SHORT_PATH_SKIPS: readonly OnboardingStepKey[] = ['health', 'about'];
/** The steps for a variant. (`_goal` is kept for callers; no step depends on it now.) */
export function stepsFor(variant: OnboardingVariant, _goal: RunningGoal | null = null) {
  return ONBOARDING_STEPS.filter(s =>
    variant !== 'short' || !SHORT_PATH_SKIPS.includes(s.key));
}

export type UsualRunTime = 'early' | 'morning' | 'evening' | 'varies';
export type Niggle = 'knee' | 'shin' | 'calf' | 'hip' | 'foot';
export const NIGGLES: { key: Niggle; label: string }[] = [
  { key: 'knee', label: 'Knee' }, { key: 'shin', label: 'Shin' }, { key: 'calf', label: 'Calf / Achilles' },
  { key: 'hip', label: 'Hip / back' }, { key: 'foot', label: 'Foot' },
];

/** A race goal time, "mm:ss" or "h:mm:ss" (10 min to 10 h). Empty is fine (no goal). */
export function parseGoalTime(input: string): { ok: true; seconds: number | null } | { ok: false } {
  const t = input.trim();
  if (!t) return { ok: true, seconds: null };
  const parts = t.split(':').map(p => (/^\d{1,2}$/.test(p) ? Number(p) : NaN));
  if (parts.length < 2 || parts.length > 3 || parts.some(n => !Number.isFinite(n))) return { ok: false };
  const [h, m, sec] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (m > 59 || sec > 59) return { ok: false };
  const total = h * 3600 + m * 60 + sec;
  return total >= 600 && total <= 36000 ? { ok: true, seconds: total } : { ok: false };
}

/** Sunday of the plan's last week, `weeks` weeks from the coming Monday (as the plan builder counts). */
export function raceDateForWeeks(today: string, weeks: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const firstMonday = dow === 0 ? d : new Date(d.getTime() + (7 - dow) * 86_400_000);
  return new Date(firstMonday.getTime() + (weeks * 7 - 1) * 86_400_000).toISOString().slice(0, 10);
}

export interface OnboardingData {
  // Location (required to play; the step still lets them continue if they decline)
  lastKnownLocation: { lat: number; lng: number } | null;
  country: string | null;
  // Why do you run?
  goal: RunningGoal | null;
  // Your running now
  runsPerWeek: number;
  usualKm: number;
  /** As typed, "mm:ss"; parsed when saving. Optional. */
  fiveKInput: string;
  // Health app (optional, its own consent)
  healthConsent: boolean;
  healthBaseline: HealthBaseline | null;
  // About you (optional)
  ageRange: AgeRange | null;
  gender: 'male' | 'female' | 'other' | null;
  heightCm: number | null;
  weightKg: number | null;
  // Name and photo
  username: string;
  avatarUri: string | null;
  // Alerts
  notificationsEnabled: boolean;
  distanceUnit: 'km' | 'mi';
  // Race (race goal only)
  raceDistance: RaceDistance | null;
  raceWeeks: number;
  /** As typed, "h:mm:ss" or "mm:ss"; optional. */
  raceGoalInput: string;
  // Your week
  runDays: number[];
  longRunDay: number;
  usualTime: UsualRunTime | null;
  weekdayMinutes: number | null;
  // Your body
  niggles: Niggle[];
  returning: boolean;
  /** Chosen voice; null means the goal's default. */
  paceXTone: PaceXTone | null;
}

/** Wording version recorded with health consent; bump when the text changes. */
export const HEALTH_CONSENT_VERSION = 'health-v1-2026-11';
