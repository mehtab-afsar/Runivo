export interface Club {
  id: string;
  name: string;
  description: string | null;
  badge_emoji: string;
  member_count: number;
  total_km: number;
  join_policy: string;
  joined: boolean;
}

export interface LobbyRoom {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  is_active: boolean;
  badge_emoji: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  avatar_color: string;
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
