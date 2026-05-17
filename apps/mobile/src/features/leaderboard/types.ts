export type LeaderboardTab = 'territory_score' | 'distance' | 'weekly_pace';
export type LeaderboardTimeFrame = 'week' | 'month' | 'all';
export type LeaderboardScope = 'local' | 'national' | 'global';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  runnerRank: string;
  value: number;
  isPlayer: boolean;
}
