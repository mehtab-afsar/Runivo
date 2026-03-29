export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

export interface NotifConfig { emoji: string; bg: string; fg: string }

export const NOTIF_CONFIG: Record<string, NotifConfig> = {
  kudos:             { emoji: '👍', bg: '#EDFAF2', fg: '#1A6B40' },
  territory_claimed: { emoji: '🚩', bg: '#FEF0EE', fg: '#D93518' },
  territory_lost:    { emoji: '😱', bg: '#FEF0EE', fg: '#D93518' },
  territory_captured:{ emoji: '⚡', bg: '#FEF0EE', fg: '#D93518' },
  zone_attacked:     { emoji: '⚔️', bg: '#FEF0E6', fg: '#C25A00' },
  level_up:          { emoji: '🎉', bg: '#FDF6E8', fg: '#9E6800' },
  achievement:       { emoji: '🏆', bg: '#FDF6E8', fg: '#9E6800' },
  mission_complete:  { emoji: '✅', bg: '#EDFAF2', fg: '#1A6B40' },
  streak:            { emoji: '🔥', bg: '#FEF0E6', fg: '#C25A00' },
  follow:            { emoji: '👥', bg: '#EEF3FE', fg: '#1445AA' },
  new_event:         { emoji: '📅', bg: '#EEF3FE', fg: '#1445AA' },
  coins_earned:      { emoji: '🪙', bg: '#FDF6E8', fg: '#9E6800' },
  challenge:         { emoji: '⚔️', bg: '#FEF0E6', fg: '#C25A00' },
};

/** @deprecated use NOTIF_CONFIG */
export const NOTIF_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(NOTIF_CONFIG).map(([k, v]) => [k, v.emoji])
);
