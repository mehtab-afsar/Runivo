export type EventTab = 'upcoming' | 'challenges' | 'past'

export type EventType =
  | 'territory-war'
  | 'king-of-hill'
  | 'survival'
  | 'brand-challenge'
  | 'community'

export interface RunEvent {
  id: string
  title: string
  description: string
  category: string
  date: string
  time: string
  location: string
  distance?: string
  participants: number
  organizer: string
  organizerInitial: string
  joined: boolean
  startsAt: string
  endsAt: string
}

export const categoryLabel: Record<string, string> = {
  race: 'Race',
  meetup: 'Meetup',
  challenge: 'Challenge',
  community: 'Community',
  'territory-war': 'Territory War',
  'king-of-hill': 'King of the Hill',
  survival: 'Survival',
  'brand-challenge': 'Brand Challenge',
}
