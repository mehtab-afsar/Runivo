import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** The service-role client every module shares (untyped schema: queries are string-keyed). */
export type Db = SupabaseClient;

export type Feature = 'weekly_brief' | 'post_run' | 'training_plan' | 'coach_chat' | 'nutrition_insights' | 'quick_prompts' | 'territory_strategy' | 'adapt_plan' | 'pace_intelligence' | 'habit_tracking' | 'food_scan';

/** POST body of the ai-coach endpoint. */
export interface RequestBody {
  feature:       Feature;
  runId?:        string;
  message?:      string;
  goal?:         string;
  planId?:       string;
  imageBase64?:  string;
  mediaType?:    string;
}

export interface WeeklyBriefPayload {
  headline: string;
  insights: string[];
  tip: string;
  nutrition?: {
    summary: string;
    connection: string;
    priority: string;
  };
}

export interface PostRunPayload {
  praise: string;
  analysis: string;
  suggestion: string;
  recovery?: string;
}

export interface NutritionInsightsPayload {
  cards: Array<{
    title: string;
    body: string;
    icon: string;
  }>;
  generatedAt: string;
}

export interface PaceIntelligencePayload {
  insights: Array<{
    icon: string;
    headline: string;
    body: string;
    recommendation: string;
  }>;
  generatedAt: string;
}

export interface QuickPrompt {
  label: string;
  message: string;
}

export interface RunRecord {
  id: string;
  distance_m: number | null;
  duration_sec: number | null;
  avg_pace: string | null;
  started_at: string;
  territories_claimed: string[] | null;
  // Selected by the context query; absent on rows fetched elsewhere.
  avg_hr?: number | null;
  max_hr?: number | null;
  avg_cadence?: number | null;
  elevation_gain_m?: number | null;
  hrv_ms?: number | null;
  calories_kcal?: number | null;
}

export interface NutritionDayLog {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface PlanCompliance {
  goal: string;
  weekCurrent: number;
  weeksTotal: number;
  sessionsPlannedThisWeek: number;
  sessionsCompletedThisWeek: number;
  sessionsMissedThisWeek: number;
  kmActualThisWeek: number;
  streakDays: number;
  consistencyLast8Weeks: number[];
  avgConsistencyLast8Weeks: number | null;
  /** Planned sessions from today through the next 7 days, one line each (v2 plans). */
  upcoming: string[];
  /** Last week's sessions: planned vs done (non-race). Null in the plan's first week. */
  lastWeek: { planned: number; done: number } | null;
  /** Race and target, e.g. "10K on 2027-01-18, target 52:30" (v2 plans). */
  race: string | null;
}

export interface NutritionContext {
  dailyGoalKcal: number;
  proteinGoalG: number;
  goal: string;
  weightKg: number;
  recentAvgKcal: number;
  recentAvgProteinG: number;
  daysHitKcalTarget: number;
  daysUnderProtein80g: number;
  dailyLogs: NutritionDayLog[];
  daysUntilEvent: number | null;
}

export interface RunnerProfile {
  goal: string | null;
  tone: string;
  experience: string | null;
  weeklyRuns: number | null;
  declaredWeeklyKm: number | null;
  usualDistanceKm: number | null;
  recent5kSeconds: number | null;
  ageRange: string | null;
  healthBaseline: unknown;
  /** 20261115000026: race, week and body from onboarding. */
  raceDistance: string | null;
  raceDate: string | null;
  raceGoalSeconds: number | null;
  runDays: number[] | null;
  longRunDay: number | null;
  usualRunTime: string | null;
  weekdayMinutes: number | null;
  niggles: string[];
  returningFromBreak: boolean;
}

export interface ShoeContext {
  name: string;
  totalKm: number;
  maxKm: number;
  pctWorn: number;
  isDefault: boolean;
}

/** Everything the handlers know about the runner, built once per request. */
export interface UserContext {
  runs90d: RunRecord[];
  totalKm90d: number;
  weeklyKm: number;
  trend: string;
  paceZones: { easy: number; moderate: number; tempo: number; hard: number };
  easyPace: string;
  tempoPace: string;
  prs: { fastestPace: string | null; longestRun: number; best5kPace: string | null };
  racePredictions: { fiveK: string; tenK: string; half: string; full: string } | null;
  staleZoneCount: number;
  avgFreshness: number;
  totalAreaM2: number;
  largestTierHeld: string;
  territoryScore: number;
  runnerRank: string;
  paceWeeklyEarned: number;
  paceWeeklyCapLimit: number;
  /** What the runner told us in onboarding (goal, level, tone, baseline). */
  runner: RunnerProfile;
  planCompliance: PlanCompliance | null;
  nutrition: NutritionContext | null;
  shoes: ShoeContext[];
}
