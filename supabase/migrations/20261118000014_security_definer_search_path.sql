-- ============================================================
-- Security: fix the search path of older privileged functions
-- ============================================================
-- SECURITY DEFINER functions run with the owner's rights. Without a fixed
-- search_path, a caller who can create objects in a schema earlier on their
-- search_path could make such a function call their own same-named function
-- or table. Every privileged function written since November sets one; these
-- older ones didn't (found by scripts/lint-migrations.mjs once the history was
-- consolidated). 'extensions' is included so PostGIS calls keep working
-- wherever the extension is installed. Behaviour is otherwise unchanged.

ALTER FUNCTION public.accept_club_join_request(request_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.add_comment(p_post_id uuid, p_content text) SET search_path = public, extensions;
ALTER FUNCTION public.apply_pace_adjustment(p_user_id uuid, p_pace_delta integer) SET search_path = public, extensions;
ALTER FUNCTION public.count_defendable_stale_zones(p_wkt text, p_owner_id uuid, p_stale_at smallint) SET search_path = public, extensions;
ALTER FUNCTION public.defend_own_territories(p_wkt text, p_owner_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.diagnose_pace_ledger() SET search_path = public, extensions;
ALTER FUNCTION public.find_routes_nearby(p_lng double precision, p_lat double precision, p_radius_m double precision) SET search_path = public, extensions;
ALTER FUNCTION public.get_post_likers(p_post_id uuid, lim integer) SET search_path = public, extensions;
ALTER FUNCTION public.grant_award(p_user_id uuid, p_award_id text) SET search_path = public, extensions;
ALTER FUNCTION public.log_club_activity_on_join() SET search_path = public, extensions;
ALTER FUNCTION public.mark_notifications_read() SET search_path = public, extensions;
ALTER FUNCTION public.notify_comment() SET search_path = public, extensions;
ALTER FUNCTION public.notify_follow() SET search_path = public, extensions;
ALTER FUNCTION public.notify_push_on_notification() SET search_path = public, extensions;
ALTER FUNCTION public.report_post(p_post_id uuid, p_reason text) SET search_path = public, extensions;
ALTER FUNCTION public.run_kudos_count(run_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.send_run_reminders() SET search_path = public, extensions;
ALTER FUNCTION public.send_weekly_summaries() SET search_path = public, extensions;
ALTER FUNCTION public.sync_club_member_count() SET search_path = public, extensions;
ALTER FUNCTION public.sync_comment_count() SET search_path = public, extensions;
ALTER FUNCTION public.sync_event_participant_count() SET search_path = public, extensions;
ALTER FUNCTION public.sync_follow_counts() SET search_path = public, extensions;
ALTER FUNCTION public.sync_profile_run_stats() SET search_path = public, extensions;
ALTER FUNCTION public.sync_territory_score(p_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.sync_user_awards(p_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.territory_polygons_sync_score() SET search_path = public, extensions;
ALTER FUNCTION public.toggle_follow(target_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.toggle_like(p_post_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.unread_notification_count() SET search_path = public, extensions;
