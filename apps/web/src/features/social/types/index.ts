export type FeedTab = 'following' | 'discover'
export type DiscoverSubTab = 'nearby' | 'popular' | 'clubs' | 'contacts'

export interface FeedPost {
  id: string
  userId: string
  userName: string
  userInitial: string
  userColor: string
  userLevel: number
  timeAgo: string
  distanceKm: number
  durationMin: number
  pace: string
  territoriesClaimed: number
  likes: number
  comments: number
  liked: boolean
  content?: string
  isEpic?: boolean
}

export interface SuggestedRunner {
  id: string
  name: string
  initial: string
  color: string
  level: number
  totalDistance: number
  territories: number
  mutualCount: number
  mutualNames: string[]
  weeklyKm?: number
  badge?: 'top10' | 'streak' | 'conqueror'
  joinedDate?: string
  recentActivities: string[]
}

export interface ContactEntry {
  name: string
  phone?: string
  email?: string
  onRunivo: boolean
  runnerId?: string
}
