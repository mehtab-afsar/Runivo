-- Removes everything demo_data.sql added (every row with an id starting "de3",
-- and the demo runners). Run in Supabase → SQL Editor.
-- The test account's PACE, rank and stats stay as the seed left them; its seeded
-- runs and zones are removed.
BEGIN;
SELECT set_config('runivo.trusted_writer', 'on', true);
DELETE FROM public.feed_post_likes  WHERE post_id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.feed_posts       WHERE id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.territory_polygons WHERE id::text LIKE 'de3%' OR owner_id::text LIKE 'de3%';
DELETE FROM public.runs             WHERE id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.followers        WHERE follower_id::text LIKE 'de3%' OR following_id::text LIKE 'de3%';
DELETE FROM public.event_participants WHERE event_id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.events           WHERE id::text LIKE 'de3%';
DELETE FROM public.club_messages    WHERE id::text LIKE 'de3%' OR club_id::text LIKE 'de3%';
DELETE FROM public.club_activity    WHERE club_id::text LIKE 'de3%';
DELETE FROM public.lobby_messages   WHERE user_id::text LIKE 'de3%';
-- Clubs first: deleting a club cascades to its members (the last-owner guard allows that).
DELETE FROM public.clubs            WHERE id::text LIKE 'de3%';
DELETE FROM public.club_members     WHERE club_id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.pace_redemptions WHERE reward_id::text LIKE 'de3%';
DELETE FROM public.reward_codes     WHERE reward_id::text LIKE 'de3%';
DELETE FROM public.pace_store_rewards WHERE id::text LIKE 'de3%';
DELETE FROM public.partners         WHERE id::text LIKE 'de3%';
DELETE FROM public.notifications    WHERE id::text LIKE 'de3%';
DELETE FROM public.user_awards      WHERE id::text LIKE 'de3%';
DELETE FROM public.profiles         WHERE id::text LIKE 'de3%';
DELETE FROM auth.users              WHERE id::text LIKE 'de3%';
COMMIT;
