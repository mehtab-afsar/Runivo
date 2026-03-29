export type ActivityType = 'run' | 'trail' | 'interval' | 'long_run';

export interface FeedPost {
  id: string;
  userId: string;
  username: string;
  avatarColor: string;
  distanceM: number;
  durationSec: number;
  avgPace: string;
  territoriesClaimed: number;
  xpEarned: number;
  createdAt: string;
  kudosCount: number;
  hasKudos: boolean;
  commentCount?: number;
  activityType?: ActivityType;
  storyImageUrl?: string;
  isPR?: boolean;
  streakDays?: number;
  routePoints?: { lat: number; lng: number }[];
}

export interface SuggestedRunner {
  id: string;
  username: string;
  level: number;
  totalDistanceKm: number;
  territoriesClaimed: number;
}
