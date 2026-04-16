export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Simplified onboarding profile written to Supabase on completion. */
export interface OnboardingProfile {
  username: string;
  avatarColor: string;
  goal: 'territory' | 'fitness' | 'social';
  weeklyTarget: number;
  notifications: boolean;
}

export interface OnboardingData {
  age: number;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: number;
  weightKg: number;
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  weeklyFrequency: number;
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
  plan: 'premium' | 'free';
}

export const EXP_OPTIONS: { key: OnboardingData['experienceLevel']; label: string; sub: string }[] = [
  { key: 'new',         label: 'Just starting',  sub: 'Under 6 months of running' },
  { key: 'casual',      label: 'Casual runner',  sub: '1–3 runs a week, no pressure' },
  { key: 'regular',     label: 'Regular runner', sub: '4+ runs a week, track PRs' },
  { key: 'competitive', label: 'Competitive',    sub: 'Races, strict training plans' },
];

export const GOAL_OPTIONS: { key: OnboardingData['primaryGoal']; label: string; sub: string }[] = [
  { key: 'get_fit',     label: 'Get fit',     sub: 'Build endurance and consistency' },
  { key: 'lose_weight', label: 'Lose weight', sub: 'Burn calories, track progress' },
  { key: 'run_faster',  label: 'Run faster',  sub: 'Improve pace and performance' },
  { key: 'explore',     label: 'Explore',     sub: 'Discover new routes and places' },
  { key: 'compete',     label: 'Compete',     sub: 'Dominate the leaderboard' },
];

export const DIST_CHIPS: { key: OnboardingData['preferredDistance']; label: string; km: number; sub: string }[] = [
  { key: 'short', label: '< 3 km', km: 2.5, sub: 'Short' },
  { key: '5k',    label: '5 km',   km: 5,   sub: 'Medium' },
  { key: '10k',   label: '10 km',  km: 10,  sub: 'Long' },
  { key: 'long',  label: '15+ km', km: 15,  sub: 'Epic' },
];

export const GOAL_LABELS: Record<string, string> = {
  get_fit: 'Get Fit', lose_weight: 'Lose Weight',
  run_faster: 'Run Faster', explore: 'Explore', compete: 'Compete',
};

export const EXP_LABELS: Record<string, string> = {
  new: 'Beginner', casual: 'Casual', regular: 'Regular', competitive: 'Competitive',
};

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const AGES    = Array.from({ length: 90 },  (_, i) => 10 + i);
export const HEIGHTS = Array.from({ length: 121 }, (_, i) => 100 + i);
export const WEIGHTS = Array.from({ length: 171 }, (_, i) => 30 + i);
export const TOTAL_STEPS = 7;
