export type LeaderboardTab = 'distance' | 'xp' | 'territories';
export type LeaderboardTimeFrame = 'week' | 'month' | 'all';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  level: number;
  value: number;
  isPlayer: boolean;
}
