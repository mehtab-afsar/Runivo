-- Expand the notifications.type CHECK constraint to cover all valid types.
-- The original constraint (in 20260301000009_runs.sql) only allowed 9 types,
-- causing silent INSERT failures for achievement, follow, mission_complete,
-- territory_captured, zone_attacked, challenge, new_event, rank_up, pace_cap.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'kudos', 'comment',
    'territory_claimed', 'territory_lost', 'territory_captured', 'zone_attacked',
    'event_reminder', 'new_event',
    'club_join', 'club_invite',
    'streak', 'system', 'follow', 'challenge',
    'achievement', 'mission_complete',
    'rank_up', 'pace_cap'
  ));
