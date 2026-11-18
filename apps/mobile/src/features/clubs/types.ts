export interface Club {
  id: string;
  name: string;
  description: string | null;
  badge_emoji: string;
  member_count: number;
  total_km: number;
  join_policy: string;
  joined: boolean;
  /** Local only: a join request was sent to this invite-only club and is awaiting approval. */
  requested?: boolean;
  /** Rounded km from the runner, when the club is near them. */
  distance_km?: number | null;
  /** Approximate area name the owner set, if any. */
  city?: string | null;
  /** Club picture and cover (club-media bucket, 20261117000010). */
  avatar_url?: string | null;
  banner_url?: string | null;
}

/** Clubs for the "Near you" list: nearby ones, or the most popular as a fallback. */
export interface NearbyClubs {
  clubs: Club[];
  /** false when the list is the popular fallback (no location, or nothing close). */
  nearby: boolean;
}

export type ActivityAction = 'captured' | 'lost' | 'defended' | 'joined' | 'leveled_up';

export interface ActivityItem {
  id: string;
  userId: string;
  username: string;
  action: ActivityAction;
  detail: string;
  time: string;
}

/** Activity item plus which club it happened in — for the cross-club strip on the main Feed. */
export interface ClubFeedActivityItem extends ActivityItem {
  clubId: string;
  clubName: string;
  badgeEmoji: string;
  memberCount: number;
  totalKm: number;
}

export interface ClubMember {
  id: string;
  username: string;
  level: number;
  total_km: number;
  role: 'admin' | 'member';
}

export interface JoinRequest {
  id: string;
  userId: string;
  username: string;
  requestedAt: string;
}
