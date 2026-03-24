export type LeaderboardTab = 'distance' | 'xp' | 'territories';
export type LeaderboardTimeFrame = 'week' | 'month' | 'all';
export type LeaderboardScope = 'local' | 'national' | 'global';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  level: number;
  value: number;
  isPlayer: boolean;
}
