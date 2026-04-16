export interface RunEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  time: string;
  location: string;
  distance?: string;
  participants: number;
  organizer?: string;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  'community-run': '🏃',
  'race': '🏆',
  'challenge': '⚡',
  'brand-challenge': '🎯',
  'king-of-hill': '👑',
  'survival': '💀',
};
