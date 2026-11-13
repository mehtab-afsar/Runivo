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
  activityType: 'run' | 'trail' | 'trail_run' | 'walk' | 'hike' | 'cycle' | 'interval' | 'long_run' | (string & {});
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
  /** Set by the runner in Edit activity. */
  title: string | null;
  description: string | null;
  visibility: 'everyone' | 'followers' | 'only_me';
  /** Public URLs of the activity's photos. */
  photos: string[];
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
