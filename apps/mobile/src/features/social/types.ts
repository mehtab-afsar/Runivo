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
  storyImageUrl?: string;
}
