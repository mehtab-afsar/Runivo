// ── Standalone union type exports ────────────────────────────────────────────

export type MissionType =
  | 'run_distance'
  | 'claim_territories'
  | 'capture_enemy'
  | 'speed_run'
  | 'run_streak'
  | 'defend_zone'
  | 'steal_rival'
  | 'complete_run'
  | 'beat_pace';

export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike' | 'trail' | 'interval' | 'long_run';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type SubscriptionTier = 'free' | 'premium';

// ── Core game mechanics types ─────────────────────────────────────────────────

export interface Territory {
  id: string;
  hexId: string;
  coordinates: {
    lat: number;
    lng: number;
    vertices: [number, number][];
  };
  state: 'unclaimed' | 'owned' | 'allied' | 'enemy' | 'contested';
  owner?: {
    id: string;
    name: string;
    level: number;
    avatar: string;
  };
  defenseStrength: number;
  dailyIncome: number;
  claimRequirements: {
    distance: number; // km
    minPace?: string;
    timeWindow?: string;
  };
  history: {
    claimedAt: Date;
    lastDefended?: Date;
    attackCount: number;
    defenseCount: number;
  };
  bonuses?: {
    type: 'crown' | 'brand' | 'special';
    multiplier: number;
    partner?: string;
  };
}

export interface PlayerStats {
  id: string;
  level: number;
  xp: number;
  xpToNext: number;
  currencies: {
    coins: number;
    diamonds: number;
    brandPoints: {
      [brand: string]: number;
    };
  };
  energy: {
    current: number;
    max: number;
    lastRegen: Date;
    regenRate: number; // per minute
  };
  territories: {
    owned: number;
    defended: number;
    attacked: number;
    dailyIncome: number;
  };
  subscription: {
    tier: 'free' | 'premium';
    expires?: Date;
    benefits: string[];
  };
  achievements: string[];
  dailyStreak: number;
  lastActive: Date;
}

export interface GameAction {
  id: string;
  type: 'claim' | 'attack' | 'defend' | 'fortify';
  playerId: string;
  territoryId: string;
  requirements: {
    energyCost: number;
    distance: number;
    minPace?: string;
  };
  rewards: {
    xp: number;
    coins: number;
    diamonds?: number;
    brandPoints?: { [brand: string]: number };
  };
  startTime: Date;
  duration: number; // minutes
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'brand';
  category: 'distance' | 'territories' | 'speed' | 'consistency' | 'social';
  partner?: string;
  requirements: {
    target: number;
    unit: string;
    timeLimit: Date;
  };
  progress: number;
  rewards: {
    xp: number;
    coins: number;
    diamonds?: number;
    brandPoints?: { [brand: string]: number };
    realWorld?: {
      type: 'discount' | 'product' | 'voucher';
      value: string;
      partner: string;
    };
  };
  participants: number;
  completed: boolean;
}

export interface BrandPartnership {
  id: string;
  name: string;
  logo: string;
  color: string;
  territories: string[]; // territory IDs
  challenges: Challenge[];
  rewards: {
    tier1: { threshold: number; reward: string };
    tier2: { threshold: number; reward: string };
    tier3: { threshold: number; reward: string };
  };
  discounts: {
    permanent: number; // percentage
    seasonal: { start: Date; end: Date; discount: number }[];
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'distance' | 'territories' | 'speed' | 'consistency' | 'social' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirements: {
    type: string;
    target: number;
    conditions?: string[];
  };
  rewards: {
    xp: number;
    diamonds: number;
    title?: string;
    badge?: string;
  };
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
}

export interface Season {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  theme: string;
  leagues: {
    iron: { min: number; max: number };
    bronze: { min: number; max: number };
    silver: { min: number; max: number };
    gold: { min: number; max: number };
    platinum: { min: number; max: number };
    diamond: { min: number; max: number };
    champion: { min: number };
  };
  rewards: {
    [league: string]: {
      badge: string;
      cosmetics: string[];
      realPrizes?: string[];
      partnerDiscounts: { [brand: string]: number };
    };
  };
}

// ── Award system types ────────────────────────────────────────────────────────

export type AwardCategory = 'territory' | 'distance' | 'streak' | 'pace';

export type AwardId =
  | 'first_claim' | 'first_blood' | 'park_capture'
  | 'district_owner' | 'quarter_owner' | 'domain_lord'
  | 'city_builder' | 'defender' | 'sovereign_rank'
  | 'first_5k' | 'first_10k' | 'first_halfmarathon'
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

export interface GameEvent {
  id: string;
  title: string;
  type: 'territory-war' | 'king-of-hill' | 'survival' | 'brand-challenge';
  startTime: Date;
  endTime: Date;
  description: string;
  rules: {
    attackMultiplier?: number;
    defenseMultiplier?: number;
    xpMultiplier?: number;
    specialConditions?: string[];
  };
  rewards: {
    participation: { xp: number; coins: number };
    leaderboard: { position: number; reward: Record<string, number> }[];
  };
  active: boolean;
}