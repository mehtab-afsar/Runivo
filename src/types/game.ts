// Core game mechanics types
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
    gems: number;
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
    tier: 'free' | 'runner-plus' | 'territory-lord' | 'empire-builder';
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
    gems?: number;
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
    gems?: number;
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
    gems: number;
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
    leaderboard: { position: number; reward: any }[];
  };
  active: boolean;
}