// ── Standalone union type exports ────────────────────────────────────────────

export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike' | 'trail' | 'interval' | 'long_run';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type SubscriptionTier = 'free' | 'premium';

// Note: MissionType lives in services/missions.ts, not here — this file used to
// define a second, divergent MissionType (plus Territory/PlayerStats/GameAction/
// Challenge/BrandPartnership/Achievement/Season, an older hex-territory + XP/coins/
// diamonds + brand-partnership design that was never wired to any screen or service).
// Removed 2026-08-09 once a fresh grep confirmed zero remaining imports — the two
// 'challenge'/'brand-challenge' strings still in the web admin campaign-type
// dropdown are unrelated string literals, not references to this Challenge type.

// ── Award system types ────────────────────────────────────────────────────────

export type AwardCategory = 'territory' | 'distance' | 'streak' | 'pace';

export type AwardId =
  | 'first_claim' | 'first_blood' | 'park_capture'
  | 'district_owner' | 'quarter_owner' | 'domain_lord'
  | 'city_builder' | 'defender' | 'sovereign_rank'
  | 'first_5k' | 'first_10k' | 'first_halfmarathon' | 'event_finisher'
  | 'km_100' | 'km_500' | 'km_1000'
  | 'streak_7' | 'streak_30' | 'early_bird'
  | 'sub_5' | 'sub_4_30' | 'monthly_100';

export interface Award {
  id: AwardId;
  title: string;
  description: string;
  icon: string;
  category: AwardCategory;
  unlockedAt: string | null;
  progressCurrent?: number;
  progressTarget?: number;
}

export interface PersonalRecord {
  fastest1kSec: number | null;
  fastest5kSec: number | null;
  fastest10kSec: number | null;
  longestRunM: number | null;
  bestPaceSec: number | null;
}

export interface ProfileStats {
  totalKm: number;
  totalRuns: number;
  avgPaceSec: number;
  totalCalories: number;
  totalZones: number;
}

// ── New territory + PACE economy types ───────────────────────────────────────

export type TerritoryTier = 'patch' | 'block' | 'district' | 'quarter' | 'domain';
export type RunnerRank = 'pacer' | 'strider' | 'chaser' | 'hunter' | 'sovereign';

export interface TerritoryPolygon {
  id: string;
  runId: string;
  ownerId: string;
  ownerName: string;
  polygon: [number, number][];   // closed ring [lng, lat][], RDP-simplified
  areaM2: number;
  freshness: number;             // 0–100
  lastDefendedAt: string;        // ISO
  claimedAt: string;             // ISO
  isLoopFill: boolean;
  tier: TerritoryTier;
  synced: boolean;
}

export interface ProcessRunTerritoryResponse {
  territoryGenerated: boolean;
  newZonesClaimed:    number;
  rivalZonesStolen:   number;
  paceAdjustment:     number;
  stolenFromUserIds:  string[];
}

// ── Training plan types ───────────────────────────────────────────────────────

export type SessionType = 'Easy Run' | 'Tempo' | 'Long Run' | 'Intervals' | 'Rest' | 'Cross-train' | 'Race';
export type PlanStatus  = 'active' | 'completed' | 'abandoned';

export interface PlannedSession {
  day:         string;
  type:        SessionType | string;
  description: string;
}

export interface TrainingWeek {
  week:     number;
  focus:    string;
  sessions: PlannedSession[];
}

export interface TrainingPlan {
  id:            string;
  userId:        string;
  goal:          string;
  goalRaceDate?: string;
  weeksTotal:    number;
  weekCurrent:   number;
  status:        PlanStatus;
  planData:      { weeks: TrainingWeek[] };
  createdAt:     string;
  updatedAt:     string;
}

