export type PostType = 'run' | 'conquest' | 'attack' | 'milestone';

export interface FeedPost {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
  distanceM: number;
  durationSec: number;
  avgPace: string;
  activityType: 'run' | 'trail' | 'interval' | 'long_run';
  routePoints: { lat: number; lng: number }[];
  kudosCount: number;
  hasKudos: boolean;
  commentCount: number;
  paceEarned: number;
  territoryTier: string | null;
  territoryAreaM2: number | null;
  runnerRank: string | null;
  postType: PostType;
  stolenFromUsername: string | null;
  stolenAreaM2: number | null;
  zoneTier: string | null;
  stolenFromUserId: string | null;
  createdAt: string;
}

export interface SuggestedRunner {
  id: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
  totalDistanceKm: number;
  territoryScore: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarColor: string;
  content: string;
  createdAt: string;
}

export interface PostLiker {
  id: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
}
