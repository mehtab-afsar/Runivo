export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

export const NOTIF_EMOJI: Record<string, string> = {
  territory_lost: '😱',
  territory_captured: '⚡',
  level_up: '🎉',
  mission_complete: '✅',
  kudos: '❤️',
  follow: '👥',
  challenge: '⚔️',
};
