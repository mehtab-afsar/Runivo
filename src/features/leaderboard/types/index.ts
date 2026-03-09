export type LeaderboardTab = 'distance' | 'territories' | 'xp'
export type TimeFrame = 'week' | 'month' | 'all'

export interface LeaderboardEntry {
  rank: number
  id?: string
  name: string
  value: number
  level: number
  isPlayer: boolean
}
