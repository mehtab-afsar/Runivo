-- ============================================================
-- Runivo — Remove all seeded mock/companion data
-- ============================================================

SET session_replication_role = 'replica';

DO $$
DECLARE
  fake_ids UUID[] := ARRAY[
    'a1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000005'
  ]::UUID[];
BEGIN
  DELETE FROM public.notifications       WHERE user_id = ANY(fake_ids);
  DELETE FROM public.feed_post_comments  WHERE user_id = ANY(fake_ids);
  DELETE FROM public.feed_post_likes     WHERE user_id = ANY(fake_ids);
  DELETE FROM public.kudos               WHERE from_id = ANY(fake_ids) OR to_id = ANY(fake_ids);
  DELETE FROM public.feed_posts          WHERE user_id = ANY(fake_ids);
  DELETE FROM public.event_participants  WHERE user_id = ANY(fake_ids);
  DELETE FROM public.club_messages       WHERE user_id = ANY(fake_ids);
  DELETE FROM public.club_join_requests  WHERE user_id = ANY(fake_ids);
  DELETE FROM public.club_members        WHERE user_id = ANY(fake_ids);
  DELETE FROM public.clubs               WHERE owner_id = ANY(fake_ids);
  DELETE FROM public.followers           WHERE follower_id = ANY(fake_ids) OR following_id = ANY(fake_ids);
  UPDATE public.territories SET owner_id = NULL, defense = 0 WHERE owner_id = ANY(fake_ids);
  DELETE FROM public.run_photos          WHERE user_id = ANY(fake_ids);
  DELETE FROM public.saved_routes        WHERE user_id = ANY(fake_ids);
  DELETE FROM public.lobby_messages      WHERE user_id = ANY(fake_ids);
  DELETE FROM public.mission_progress    WHERE user_id = ANY(fake_ids);
  DELETE FROM public.runs                WHERE user_id = ANY(fake_ids);
  DELETE FROM public.profiles            WHERE id = ANY(fake_ids);
  DELETE FROM auth.users                 WHERE id = ANY(fake_ids);
  RAISE NOTICE 'Mock data cleared successfully.';
END;
$$;

SET session_replication_role = 'origin';
