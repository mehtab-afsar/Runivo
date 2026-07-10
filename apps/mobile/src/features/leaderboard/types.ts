export type LeaderboardTab = 'territory_score' | 'distance' | 'weekly_pace';
export type LeaderboardTimeFrame = 'week' | 'month' | 'all';
// 'local' was removed — profiles only has a country column (migration 072), no
// city/region, so there was no data to scope "local" by (it silently returned
// the same results as 'global'). National scopes by country.
export type LeaderboardScope = 'national' | 'global';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  runnerRank: string;
  value: number;
  isPlayer: boolean;
}
