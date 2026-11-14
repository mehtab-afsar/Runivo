import type { RunningGoal, AgeRange, HealthBaseline } from '@shared/engine/onboarding';

/**
 * The v1 onboarding, in the PRD's order (welcome and sign-in come first and
 * live on their own screens). Optional steps can be skipped.
 */
export const ONBOARDING_STEPS = [
  { key: 'location',      label: 'Your area',    optional: false },
  { key: 'goal',          label: 'Your goal',    optional: false },
  { key: 'running',       label: 'Your running', optional: false },
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
export function stepsFor(variant: OnboardingVariant) {
  return variant === 'short' ? ONBOARDING_STEPS.filter(s => !SHORT_PATH_SKIPS.includes(s.key)) : ONBOARDING_STEPS;
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
}

/** Wording version recorded with health consent; bump when the text changes. */
export const HEALTH_CONSENT_VERSION = 'health-v1-2026-11';
