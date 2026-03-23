export type NotificationType =
  | 'kudos'
  | 'comment'
  | 'territory_claimed'
  | 'territory_lost'
  | 'event_reminder'
  | 'club_join'
  | 'club_invite'
  | 'streak'
  | 'system'
  | 'follow'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  action_url: string | null
  created_at: string
}
