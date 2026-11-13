export type EventSource = 'hosted' | 'curated';

export type Discipline =
  | 'marathon' | 'half_marathon' | '10k' | '5k'
  | 'cyclothon' | 'triathlon' | 'trail_run' | 'community_run' | 'other';

export interface RunEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  /** Raw ISO timestamp — always use this for date math/comparisons, never
   *  re-parse `date`/`time` (those are display-formatted, not parseable). */
  startsAt: string;
  date: string;
  time: string;
  location: string;
  distance?: string;
  /** Raw distance in metres, for "Train for this". */
  distanceM?: number;
  participants: number;
  organizer?: string;
  source: EventSource;
  /** Only set (and only meaningful) when source === 'curated'. */
  registrationUrl?: string;
  sourceName?: string;
  discipline?: Discipline;
  clubId?: string;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  'community-run': '🏃',
  'race': '🏆',
  'challenge': '⚡',
  'brand-challenge': '🎯',
  'king-of-hill': '👑',
  'survival': '💀',
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  marathon:       'Marathon',
  half_marathon:  'Half Marathon',
  '10k':          '10K',
  '5k':           '5K',
  cyclothon:      'Cyclothon',
  triathlon:      'Triathlon',
  trail_run:      'Trail Run',
  community_run:  'Community Run',
  other:          'Other',
};

export const DISCIPLINE_EMOJI: Record<Discipline, string> = {
  marathon:       '🏅',
  half_marathon:  '🎽',
  '10k':          '🏃',
  '5k':           '🏃',
  cyclothon:      '🚴',
  triathlon:      '🏊',
  trail_run:      '⛰️',
  community_run:  '👥',
  other:          '📅',
};
