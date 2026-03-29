export type LeaderboardTab = 'distance' | 'xp' | 'territories';
export type LeaderboardTimeFrame = 'week' | 'month' | 'all';
export type LeaderboardScope = 'local' | 'national' | 'global';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  level: number;
  value: number;
  isPlayer: boolean;
}
