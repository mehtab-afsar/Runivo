drop extension if exists "pg_net";

drop policy "events: premium only" on "public"."events";

drop view if exists "public"."leaderboard_weekly";

drop view if exists "public"."profiles_public";

set check_function_bodies = off;

create or replace view "public"."leaderboard_weekly" as  SELECT p.id,
    p.username,
    p.avatar_url,
    p.runner_rank,
    p.territory_score,
    p.pace_weekly_earned AS weekly_pace,
    (COALESCE((sum(r.distance_m) / 1000.0), (0)::numeric))::numeric(10,3) AS weekly_km,
    (COALESCE(sum(cardinality(r.territories_claimed)), (0)::bigint))::integer AS weekly_territories,
    (dense_rank() OVER (ORDER BY p.territory_score DESC))::integer AS rank,
    p.country
   FROM (public.profiles p
     LEFT JOIN public.runs r ON (((r.user_id = p.id) AND (r.started_at >= date_trunc('week'::text, (now() AT TIME ZONE 'utc'::text))))))
  GROUP BY p.id, p.username, p.avatar_url, p.runner_rank, p.territory_score, p.pace_weekly_earned, p.country;


create or replace view "public"."profiles_public" as  SELECT id,
    username,
    display_name,
    avatar_url,
    avatar_color,
    bio,
    location,
    instagram,
    strava,
    level,
    runner_rank,
    territory_score,
    pace_total_earned,
    total_distance_km,
    total_runs,
    total_territories_claimed,
    streak_days,
    follower_count,
    following_count,
    country,
    unlocked_achievements,
    pinned_run_id,
    created_at
   FROM public.profiles;


CREATE OR REPLACE FUNCTION public.sync_energy(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cur_energy   int;
  last_regen   timestamptz;
  gained       int;
  new_energy   int;
begin
  select energy, last_energy_regen
  into   cur_energy, last_regen
  from   public.profiles
  where  id = p_user_id;

  if not found then
    return 0;
  end if;

  -- 10 energy per hour = 1 per 360 seconds
  gained := floor(extract(epoch from (now() - last_regen)) / 360)::int;

  if gained <= 0 then
    return cur_energy;
  end if;

  new_energy := least(cur_energy + gained, 100);

  update public.profiles
  set    energy           = new_energy,
         last_energy_regen = now()
  where  id = p_user_id;

  return new_energy;
end;
$function$
;

grant delete on table "public"."ai_cache" to "anon";

grant insert on table "public"."ai_cache" to "anon";

grant select on table "public"."ai_cache" to "anon";

grant update on table "public"."ai_cache" to "anon";

grant delete on table "public"."ai_cache" to "authenticated";

grant insert on table "public"."ai_cache" to "authenticated";

grant select on table "public"."ai_cache" to "authenticated";

grant update on table "public"."ai_cache" to "authenticated";

grant delete on table "public"."ai_cache" to "service_role";

grant insert on table "public"."ai_cache" to "service_role";

grant select on table "public"."ai_cache" to "service_role";

grant update on table "public"."ai_cache" to "service_role";

grant delete on table "public"."ai_usage_log" to "anon";

grant insert on table "public"."ai_usage_log" to "anon";

grant select on table "public"."ai_usage_log" to "anon";

grant update on table "public"."ai_usage_log" to "anon";

grant delete on table "public"."ai_usage_log" to "authenticated";

grant insert on table "public"."ai_usage_log" to "authenticated";

grant select on table "public"."ai_usage_log" to "authenticated";

grant update on table "public"."ai_usage_log" to "authenticated";

grant delete on table "public"."ai_usage_log" to "service_role";

grant insert on table "public"."ai_usage_log" to "service_role";

grant select on table "public"."ai_usage_log" to "service_role";

grant update on table "public"."ai_usage_log" to "service_role";

grant delete on table "public"."club_activity" to "anon";

grant insert on table "public"."club_activity" to "anon";

grant select on table "public"."club_activity" to "anon";

grant update on table "public"."club_activity" to "anon";

grant delete on table "public"."club_activity" to "authenticated";

grant insert on table "public"."club_activity" to "authenticated";

grant select on table "public"."club_activity" to "authenticated";

grant update on table "public"."club_activity" to "authenticated";

grant delete on table "public"."club_activity" to "service_role";

grant insert on table "public"."club_activity" to "service_role";

grant select on table "public"."club_activity" to "service_role";

grant update on table "public"."club_activity" to "service_role";

grant delete on table "public"."club_join_requests" to "anon";

grant insert on table "public"."club_join_requests" to "anon";

grant select on table "public"."club_join_requests" to "anon";

grant update on table "public"."club_join_requests" to "anon";

grant delete on table "public"."club_join_requests" to "authenticated";

grant insert on table "public"."club_join_requests" to "authenticated";

grant select on table "public"."club_join_requests" to "authenticated";

grant update on table "public"."club_join_requests" to "authenticated";

grant delete on table "public"."club_join_requests" to "service_role";

grant insert on table "public"."club_join_requests" to "service_role";

grant select on table "public"."club_join_requests" to "service_role";

grant update on table "public"."club_join_requests" to "service_role";

grant delete on table "public"."club_locations" to "service_role";

grant insert on table "public"."club_locations" to "service_role";

grant select on table "public"."club_locations" to "service_role";

grant update on table "public"."club_locations" to "service_role";

grant delete on table "public"."club_members" to "anon";

grant insert on table "public"."club_members" to "anon";

grant select on table "public"."club_members" to "anon";

grant update on table "public"."club_members" to "anon";

grant delete on table "public"."club_members" to "authenticated";

grant insert on table "public"."club_members" to "authenticated";

grant select on table "public"."club_members" to "authenticated";

grant update on table "public"."club_members" to "authenticated";

grant delete on table "public"."club_members" to "service_role";

grant insert on table "public"."club_members" to "service_role";

grant select on table "public"."club_members" to "service_role";

grant update on table "public"."club_members" to "service_role";

grant delete on table "public"."club_messages" to "anon";

grant insert on table "public"."club_messages" to "anon";

grant select on table "public"."club_messages" to "anon";

grant update on table "public"."club_messages" to "anon";

grant delete on table "public"."club_messages" to "authenticated";

grant insert on table "public"."club_messages" to "authenticated";

grant select on table "public"."club_messages" to "authenticated";

grant update on table "public"."club_messages" to "authenticated";

grant delete on table "public"."club_messages" to "service_role";

grant insert on table "public"."club_messages" to "service_role";

grant select on table "public"."club_messages" to "service_role";

grant update on table "public"."club_messages" to "service_role";

grant delete on table "public"."clubs" to "anon";

grant insert on table "public"."clubs" to "anon";

grant select on table "public"."clubs" to "anon";

grant update on table "public"."clubs" to "anon";

grant delete on table "public"."clubs" to "authenticated";

grant insert on table "public"."clubs" to "authenticated";

grant select on table "public"."clubs" to "authenticated";

grant update on table "public"."clubs" to "authenticated";

grant delete on table "public"."clubs" to "service_role";

grant insert on table "public"."clubs" to "service_role";

grant select on table "public"."clubs" to "service_role";

grant update on table "public"."clubs" to "service_role";

grant delete on table "public"."coach_messages" to "anon";

grant insert on table "public"."coach_messages" to "anon";

grant select on table "public"."coach_messages" to "anon";

grant update on table "public"."coach_messages" to "anon";

grant delete on table "public"."coach_messages" to "authenticated";

grant insert on table "public"."coach_messages" to "authenticated";

grant select on table "public"."coach_messages" to "authenticated";

grant update on table "public"."coach_messages" to "authenticated";

grant delete on table "public"."coach_messages" to "service_role";

grant insert on table "public"."coach_messages" to "service_role";

grant select on table "public"."coach_messages" to "service_role";

grant update on table "public"."coach_messages" to "service_role";

grant delete on table "public"."device_activities" to "anon";

grant insert on table "public"."device_activities" to "anon";

grant select on table "public"."device_activities" to "anon";

grant update on table "public"."device_activities" to "anon";

grant delete on table "public"."device_activities" to "authenticated";

grant insert on table "public"."device_activities" to "authenticated";

grant select on table "public"."device_activities" to "authenticated";

grant update on table "public"."device_activities" to "authenticated";

grant delete on table "public"."device_activities" to "service_role";

grant insert on table "public"."device_activities" to "service_role";

grant select on table "public"."device_activities" to "service_role";

grant update on table "public"."device_activities" to "service_role";

grant delete on table "public"."device_connections" to "service_role";

grant insert on table "public"."device_connections" to "service_role";

grant select on table "public"."device_connections" to "service_role";

grant update on table "public"."device_connections" to "service_role";

grant delete on table "public"."event_participants" to "anon";

grant insert on table "public"."event_participants" to "anon";

grant select on table "public"."event_participants" to "anon";

grant update on table "public"."event_participants" to "anon";

grant delete on table "public"."event_participants" to "authenticated";

grant insert on table "public"."event_participants" to "authenticated";

grant select on table "public"."event_participants" to "authenticated";

grant update on table "public"."event_participants" to "authenticated";

grant delete on table "public"."event_participants" to "service_role";

grant insert on table "public"."event_participants" to "service_role";

grant select on table "public"."event_participants" to "service_role";

grant update on table "public"."event_participants" to "service_role";

grant delete on table "public"."events" to "anon";

grant insert on table "public"."events" to "anon";

grant select on table "public"."events" to "anon";

grant update on table "public"."events" to "anon";

grant delete on table "public"."events" to "authenticated";

grant insert on table "public"."events" to "authenticated";

grant select on table "public"."events" to "authenticated";

grant update on table "public"."events" to "authenticated";

grant delete on table "public"."events" to "service_role";

grant insert on table "public"."events" to "service_role";

grant select on table "public"."events" to "service_role";

grant update on table "public"."events" to "service_role";

grant delete on table "public"."expo_push_tokens" to "anon";

grant insert on table "public"."expo_push_tokens" to "anon";

grant select on table "public"."expo_push_tokens" to "anon";

grant update on table "public"."expo_push_tokens" to "anon";

grant delete on table "public"."expo_push_tokens" to "authenticated";

grant insert on table "public"."expo_push_tokens" to "authenticated";

grant select on table "public"."expo_push_tokens" to "authenticated";

grant update on table "public"."expo_push_tokens" to "authenticated";

grant delete on table "public"."expo_push_tokens" to "service_role";

grant insert on table "public"."expo_push_tokens" to "service_role";

grant select on table "public"."expo_push_tokens" to "service_role";

grant update on table "public"."expo_push_tokens" to "service_role";

grant delete on table "public"."feed_post_comments" to "anon";

grant insert on table "public"."feed_post_comments" to "anon";

grant select on table "public"."feed_post_comments" to "anon";

grant update on table "public"."feed_post_comments" to "anon";

grant delete on table "public"."feed_post_comments" to "authenticated";

grant insert on table "public"."feed_post_comments" to "authenticated";

grant select on table "public"."feed_post_comments" to "authenticated";

grant update on table "public"."feed_post_comments" to "authenticated";

grant delete on table "public"."feed_post_comments" to "service_role";

grant insert on table "public"."feed_post_comments" to "service_role";

grant select on table "public"."feed_post_comments" to "service_role";

grant update on table "public"."feed_post_comments" to "service_role";

grant delete on table "public"."feed_post_likes" to "anon";

grant insert on table "public"."feed_post_likes" to "anon";

grant select on table "public"."feed_post_likes" to "anon";

grant update on table "public"."feed_post_likes" to "anon";

grant delete on table "public"."feed_post_likes" to "authenticated";

grant insert on table "public"."feed_post_likes" to "authenticated";

grant select on table "public"."feed_post_likes" to "authenticated";

grant update on table "public"."feed_post_likes" to "authenticated";

grant delete on table "public"."feed_post_likes" to "service_role";

grant insert on table "public"."feed_post_likes" to "service_role";

grant select on table "public"."feed_post_likes" to "service_role";

grant update on table "public"."feed_post_likes" to "service_role";

grant delete on table "public"."feed_posts" to "anon";

grant insert on table "public"."feed_posts" to "anon";

grant select on table "public"."feed_posts" to "anon";

grant update on table "public"."feed_posts" to "anon";

grant delete on table "public"."feed_posts" to "authenticated";

grant insert on table "public"."feed_posts" to "authenticated";

grant select on table "public"."feed_posts" to "authenticated";

grant update on table "public"."feed_posts" to "authenticated";

grant delete on table "public"."feed_posts" to "service_role";

grant insert on table "public"."feed_posts" to "service_role";

grant select on table "public"."feed_posts" to "service_role";

grant update on table "public"."feed_posts" to "service_role";

grant delete on table "public"."followers" to "anon";

grant insert on table "public"."followers" to "anon";

grant select on table "public"."followers" to "anon";

grant update on table "public"."followers" to "anon";

grant delete on table "public"."followers" to "authenticated";

grant insert on table "public"."followers" to "authenticated";

grant select on table "public"."followers" to "authenticated";

grant update on table "public"."followers" to "authenticated";

grant delete on table "public"."followers" to "service_role";

grant insert on table "public"."followers" to "service_role";

grant select on table "public"."followers" to "service_role";

grant update on table "public"."followers" to "service_role";

grant delete on table "public"."kudos" to "anon";

grant insert on table "public"."kudos" to "anon";

grant select on table "public"."kudos" to "anon";

grant update on table "public"."kudos" to "anon";

grant delete on table "public"."kudos" to "authenticated";

grant insert on table "public"."kudos" to "authenticated";

grant select on table "public"."kudos" to "authenticated";

grant update on table "public"."kudos" to "authenticated";

grant delete on table "public"."kudos" to "service_role";

grant insert on table "public"."kudos" to "service_role";

grant select on table "public"."kudos" to "service_role";

grant update on table "public"."kudos" to "service_role";

grant delete on table "public"."live_run_positions" to "anon";

grant insert on table "public"."live_run_positions" to "anon";

grant select on table "public"."live_run_positions" to "anon";

grant update on table "public"."live_run_positions" to "anon";

grant delete on table "public"."live_run_positions" to "service_role";

grant insert on table "public"."live_run_positions" to "service_role";

grant select on table "public"."live_run_positions" to "service_role";

grant update on table "public"."live_run_positions" to "service_role";

grant delete on table "public"."lobbies" to "anon";

grant insert on table "public"."lobbies" to "anon";

grant select on table "public"."lobbies" to "anon";

grant update on table "public"."lobbies" to "anon";

grant delete on table "public"."lobbies" to "authenticated";

grant insert on table "public"."lobbies" to "authenticated";

grant select on table "public"."lobbies" to "authenticated";

grant update on table "public"."lobbies" to "authenticated";

grant delete on table "public"."lobbies" to "service_role";

grant insert on table "public"."lobbies" to "service_role";

grant select on table "public"."lobbies" to "service_role";

grant update on table "public"."lobbies" to "service_role";

grant delete on table "public"."lobby_messages" to "anon";

grant insert on table "public"."lobby_messages" to "anon";

grant select on table "public"."lobby_messages" to "anon";

grant update on table "public"."lobby_messages" to "anon";

grant delete on table "public"."lobby_messages" to "authenticated";

grant insert on table "public"."lobby_messages" to "authenticated";

grant select on table "public"."lobby_messages" to "authenticated";

grant update on table "public"."lobby_messages" to "authenticated";

grant delete on table "public"."lobby_messages" to "service_role";

grant insert on table "public"."lobby_messages" to "service_role";

grant select on table "public"."lobby_messages" to "service_role";

grant update on table "public"."lobby_messages" to "service_role";

grant delete on table "public"."mission_claims" to "anon";

grant insert on table "public"."mission_claims" to "anon";

grant select on table "public"."mission_claims" to "anon";

grant update on table "public"."mission_claims" to "anon";

grant delete on table "public"."mission_claims" to "authenticated";

grant insert on table "public"."mission_claims" to "authenticated";

grant select on table "public"."mission_claims" to "authenticated";

grant update on table "public"."mission_claims" to "authenticated";

grant delete on table "public"."mission_claims" to "service_role";

grant insert on table "public"."mission_claims" to "service_role";

grant select on table "public"."mission_claims" to "service_role";

grant update on table "public"."mission_claims" to "service_role";

grant delete on table "public"."mission_progress" to "anon";

grant insert on table "public"."mission_progress" to "anon";

grant select on table "public"."mission_progress" to "anon";

grant update on table "public"."mission_progress" to "anon";

grant delete on table "public"."mission_progress" to "authenticated";

grant insert on table "public"."mission_progress" to "authenticated";

grant select on table "public"."mission_progress" to "authenticated";

grant update on table "public"."mission_progress" to "authenticated";

grant delete on table "public"."mission_progress" to "service_role";

grant insert on table "public"."mission_progress" to "service_role";

grant select on table "public"."mission_progress" to "service_role";

grant update on table "public"."mission_progress" to "service_role";

grant delete on table "public"."notification_campaigns" to "anon";

grant insert on table "public"."notification_campaigns" to "anon";

grant select on table "public"."notification_campaigns" to "anon";

grant update on table "public"."notification_campaigns" to "anon";

grant delete on table "public"."notification_campaigns" to "authenticated";

grant insert on table "public"."notification_campaigns" to "authenticated";

grant select on table "public"."notification_campaigns" to "authenticated";

grant update on table "public"."notification_campaigns" to "authenticated";

grant delete on table "public"."notification_campaigns" to "service_role";

grant insert on table "public"."notification_campaigns" to "service_role";

grant select on table "public"."notification_campaigns" to "service_role";

grant update on table "public"."notification_campaigns" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."nutrition_logs" to "anon";

grant insert on table "public"."nutrition_logs" to "anon";

grant select on table "public"."nutrition_logs" to "anon";

grant update on table "public"."nutrition_logs" to "anon";

grant delete on table "public"."nutrition_logs" to "authenticated";

grant insert on table "public"."nutrition_logs" to "authenticated";

grant select on table "public"."nutrition_logs" to "authenticated";

grant update on table "public"."nutrition_logs" to "authenticated";

grant delete on table "public"."nutrition_logs" to "service_role";

grant insert on table "public"."nutrition_logs" to "service_role";

grant select on table "public"."nutrition_logs" to "service_role";

grant update on table "public"."nutrition_logs" to "service_role";

grant delete on table "public"."nutrition_profiles" to "anon";

grant insert on table "public"."nutrition_profiles" to "anon";

grant select on table "public"."nutrition_profiles" to "anon";

grant update on table "public"."nutrition_profiles" to "anon";

grant delete on table "public"."nutrition_profiles" to "authenticated";

grant insert on table "public"."nutrition_profiles" to "authenticated";

grant select on table "public"."nutrition_profiles" to "authenticated";

grant update on table "public"."nutrition_profiles" to "authenticated";

grant delete on table "public"."nutrition_profiles" to "service_role";

grant insert on table "public"."nutrition_profiles" to "service_role";

grant select on table "public"."nutrition_profiles" to "service_role";

grant update on table "public"."nutrition_profiles" to "service_role";

grant delete on table "public"."pace_awards" to "anon";

grant insert on table "public"."pace_awards" to "anon";

grant select on table "public"."pace_awards" to "anon";

grant update on table "public"."pace_awards" to "anon";

grant delete on table "public"."pace_awards" to "authenticated";

grant insert on table "public"."pace_awards" to "authenticated";

grant select on table "public"."pace_awards" to "authenticated";

grant update on table "public"."pace_awards" to "authenticated";

grant delete on table "public"."pace_awards" to "service_role";

grant insert on table "public"."pace_awards" to "service_role";

grant select on table "public"."pace_awards" to "service_role";

grant update on table "public"."pace_awards" to "service_role";

grant delete on table "public"."pace_discrepancy_log" to "anon";

grant insert on table "public"."pace_discrepancy_log" to "anon";

grant select on table "public"."pace_discrepancy_log" to "anon";

grant update on table "public"."pace_discrepancy_log" to "anon";

grant delete on table "public"."pace_discrepancy_log" to "authenticated";

grant insert on table "public"."pace_discrepancy_log" to "authenticated";

grant select on table "public"."pace_discrepancy_log" to "authenticated";

grant update on table "public"."pace_discrepancy_log" to "authenticated";

grant delete on table "public"."pace_discrepancy_log" to "service_role";

grant insert on table "public"."pace_discrepancy_log" to "service_role";

grant select on table "public"."pace_discrepancy_log" to "service_role";

grant update on table "public"."pace_discrepancy_log" to "service_role";

grant delete on table "public"."pace_redemptions" to "anon";

grant insert on table "public"."pace_redemptions" to "anon";

grant select on table "public"."pace_redemptions" to "anon";

grant update on table "public"."pace_redemptions" to "anon";

grant delete on table "public"."pace_redemptions" to "authenticated";

grant insert on table "public"."pace_redemptions" to "authenticated";

grant select on table "public"."pace_redemptions" to "authenticated";

grant update on table "public"."pace_redemptions" to "authenticated";

grant delete on table "public"."pace_redemptions" to "service_role";

grant insert on table "public"."pace_redemptions" to "service_role";

grant select on table "public"."pace_redemptions" to "service_role";

grant update on table "public"."pace_redemptions" to "service_role";

grant delete on table "public"."pace_store_rewards" to "anon";

grant insert on table "public"."pace_store_rewards" to "anon";

grant select on table "public"."pace_store_rewards" to "anon";

grant update on table "public"."pace_store_rewards" to "anon";

grant delete on table "public"."pace_store_rewards" to "authenticated";

grant insert on table "public"."pace_store_rewards" to "authenticated";

grant select on table "public"."pace_store_rewards" to "authenticated";

grant update on table "public"."pace_store_rewards" to "authenticated";

grant delete on table "public"."pace_store_rewards" to "service_role";

grant insert on table "public"."pace_store_rewards" to "service_role";

grant select on table "public"."pace_store_rewards" to "service_role";

grant update on table "public"."pace_store_rewards" to "service_role";

grant delete on table "public"."partners" to "anon";

grant insert on table "public"."partners" to "anon";

grant select on table "public"."partners" to "anon";

grant update on table "public"."partners" to "anon";

grant delete on table "public"."partners" to "authenticated";

grant insert on table "public"."partners" to "authenticated";

grant select on table "public"."partners" to "authenticated";

grant update on table "public"."partners" to "authenticated";

grant delete on table "public"."partners" to "service_role";

grant insert on table "public"."partners" to "service_role";

grant select on table "public"."partners" to "service_role";

grant update on table "public"."partners" to "service_role";

grant delete on table "public"."personal_records" to "anon";

grant insert on table "public"."personal_records" to "anon";

grant select on table "public"."personal_records" to "anon";

grant update on table "public"."personal_records" to "anon";

grant delete on table "public"."personal_records" to "authenticated";

grant insert on table "public"."personal_records" to "authenticated";

grant select on table "public"."personal_records" to "authenticated";

grant update on table "public"."personal_records" to "authenticated";

grant delete on table "public"."personal_records" to "service_role";

grant insert on table "public"."personal_records" to "service_role";

grant select on table "public"."personal_records" to "service_role";

grant update on table "public"."personal_records" to "service_role";

grant delete on table "public"."plan_adaptations" to "anon";

grant insert on table "public"."plan_adaptations" to "anon";

grant select on table "public"."plan_adaptations" to "anon";

grant update on table "public"."plan_adaptations" to "anon";

grant delete on table "public"."plan_adaptations" to "authenticated";

grant insert on table "public"."plan_adaptations" to "authenticated";

grant select on table "public"."plan_adaptations" to "authenticated";

grant update on table "public"."plan_adaptations" to "authenticated";

grant delete on table "public"."plan_adaptations" to "service_role";

grant insert on table "public"."plan_adaptations" to "service_role";

grant select on table "public"."plan_adaptations" to "service_role";

grant update on table "public"."plan_adaptations" to "service_role";

grant delete on table "public"."post_reports" to "anon";

grant insert on table "public"."post_reports" to "anon";

grant select on table "public"."post_reports" to "anon";

grant update on table "public"."post_reports" to "anon";

grant delete on table "public"."post_reports" to "authenticated";

grant insert on table "public"."post_reports" to "authenticated";

grant select on table "public"."post_reports" to "authenticated";

grant update on table "public"."post_reports" to "authenticated";

grant delete on table "public"."post_reports" to "service_role";

grant insert on table "public"."post_reports" to "service_role";

grant select on table "public"."post_reports" to "service_role";

grant update on table "public"."post_reports" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."promotions" to "anon";

grant insert on table "public"."promotions" to "anon";

grant select on table "public"."promotions" to "anon";

grant update on table "public"."promotions" to "anon";

grant delete on table "public"."promotions" to "authenticated";

grant insert on table "public"."promotions" to "authenticated";

grant select on table "public"."promotions" to "authenticated";

grant update on table "public"."promotions" to "authenticated";

grant delete on table "public"."promotions" to "service_role";

grant insert on table "public"."promotions" to "service_role";

grant select on table "public"."promotions" to "service_role";

grant update on table "public"."promotions" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";

grant delete on table "public"."reward_codes" to "anon";

grant insert on table "public"."reward_codes" to "anon";

grant select on table "public"."reward_codes" to "anon";

grant update on table "public"."reward_codes" to "anon";

grant delete on table "public"."reward_codes" to "authenticated";

grant insert on table "public"."reward_codes" to "authenticated";

grant select on table "public"."reward_codes" to "authenticated";

grant update on table "public"."reward_codes" to "authenticated";

grant delete on table "public"."reward_codes" to "service_role";

grant insert on table "public"."reward_codes" to "service_role";

grant select on table "public"."reward_codes" to "service_role";

grant update on table "public"."reward_codes" to "service_role";

grant delete on table "public"."reward_events" to "anon";

grant insert on table "public"."reward_events" to "anon";

grant select on table "public"."reward_events" to "anon";

grant update on table "public"."reward_events" to "anon";

grant delete on table "public"."reward_events" to "authenticated";

grant insert on table "public"."reward_events" to "authenticated";

grant select on table "public"."reward_events" to "authenticated";

grant update on table "public"."reward_events" to "authenticated";

grant delete on table "public"."reward_events" to "service_role";

grant insert on table "public"."reward_events" to "service_role";

grant select on table "public"."reward_events" to "service_role";

grant update on table "public"."reward_events" to "service_role";

grant delete on table "public"."reward_view_keys" to "anon";

grant insert on table "public"."reward_view_keys" to "anon";

grant select on table "public"."reward_view_keys" to "anon";

grant update on table "public"."reward_view_keys" to "anon";

grant delete on table "public"."reward_view_keys" to "authenticated";

grant insert on table "public"."reward_view_keys" to "authenticated";

grant select on table "public"."reward_view_keys" to "authenticated";

grant update on table "public"."reward_view_keys" to "authenticated";

grant delete on table "public"."reward_view_keys" to "service_role";

grant insert on table "public"."reward_view_keys" to "service_role";

grant select on table "public"."reward_view_keys" to "service_role";

grant update on table "public"."reward_view_keys" to "service_role";

grant delete on table "public"."run_photos" to "anon";

grant insert on table "public"."run_photos" to "anon";

grant select on table "public"."run_photos" to "anon";

grant update on table "public"."run_photos" to "anon";

grant delete on table "public"."run_photos" to "authenticated";

grant insert on table "public"."run_photos" to "authenticated";

grant select on table "public"."run_photos" to "authenticated";

grant update on table "public"."run_photos" to "authenticated";

grant delete on table "public"."run_photos" to "service_role";

grant insert on table "public"."run_photos" to "service_role";

grant select on table "public"."run_photos" to "service_role";

grant update on table "public"."run_photos" to "service_role";

grant delete on table "public"."run_processing" to "anon";

grant insert on table "public"."run_processing" to "anon";

grant select on table "public"."run_processing" to "anon";

grant update on table "public"."run_processing" to "anon";

grant delete on table "public"."run_processing" to "authenticated";

grant insert on table "public"."run_processing" to "authenticated";

grant select on table "public"."run_processing" to "authenticated";

grant update on table "public"."run_processing" to "authenticated";

grant delete on table "public"."run_processing" to "service_role";

grant insert on table "public"."run_processing" to "service_role";

grant select on table "public"."run_processing" to "service_role";

grant update on table "public"."run_processing" to "service_role";

grant delete on table "public"."run_territories" to "anon";

grant insert on table "public"."run_territories" to "anon";

grant select on table "public"."run_territories" to "anon";

grant update on table "public"."run_territories" to "anon";

grant delete on table "public"."run_territories" to "authenticated";

grant insert on table "public"."run_territories" to "authenticated";

grant select on table "public"."run_territories" to "authenticated";

grant update on table "public"."run_territories" to "authenticated";

grant delete on table "public"."run_territories" to "service_role";

grant insert on table "public"."run_territories" to "service_role";

grant select on table "public"."run_territories" to "service_role";

grant update on table "public"."run_territories" to "service_role";

grant delete on table "public"."run_territory_contests" to "anon";

grant insert on table "public"."run_territory_contests" to "anon";

grant select on table "public"."run_territory_contests" to "anon";

grant update on table "public"."run_territory_contests" to "anon";

grant delete on table "public"."run_territory_contests" to "authenticated";

grant insert on table "public"."run_territory_contests" to "authenticated";

grant select on table "public"."run_territory_contests" to "authenticated";

grant update on table "public"."run_territory_contests" to "authenticated";

grant delete on table "public"."run_territory_contests" to "service_role";

grant insert on table "public"."run_territory_contests" to "service_role";

grant select on table "public"."run_territory_contests" to "service_role";

grant update on table "public"."run_territory_contests" to "service_role";

grant delete on table "public"."runs" to "anon";

grant insert on table "public"."runs" to "anon";

grant select on table "public"."runs" to "anon";

grant update on table "public"."runs" to "anon";

grant delete on table "public"."runs" to "authenticated";

grant insert on table "public"."runs" to "authenticated";

grant select on table "public"."runs" to "authenticated";

grant update on table "public"."runs" to "authenticated";

grant delete on table "public"."runs" to "service_role";

grant insert on table "public"."runs" to "service_role";

grant select on table "public"."runs" to "service_role";

grant update on table "public"."runs" to "service_role";

grant delete on table "public"."saved_routes" to "anon";

grant insert on table "public"."saved_routes" to "anon";

grant select on table "public"."saved_routes" to "anon";

grant update on table "public"."saved_routes" to "anon";

grant delete on table "public"."saved_routes" to "authenticated";

grant insert on table "public"."saved_routes" to "authenticated";

grant select on table "public"."saved_routes" to "authenticated";

grant update on table "public"."saved_routes" to "authenticated";

grant delete on table "public"."saved_routes" to "service_role";

grant insert on table "public"."saved_routes" to "service_role";

grant select on table "public"."saved_routes" to "service_role";

grant update on table "public"."saved_routes" to "service_role";

grant delete on table "public"."shoes" to "anon";

grant insert on table "public"."shoes" to "anon";

grant select on table "public"."shoes" to "anon";

grant update on table "public"."shoes" to "anon";

grant delete on table "public"."shoes" to "authenticated";

grant insert on table "public"."shoes" to "authenticated";

grant select on table "public"."shoes" to "authenticated";

grant update on table "public"."shoes" to "authenticated";

grant delete on table "public"."shoes" to "service_role";

grant insert on table "public"."shoes" to "service_role";

grant select on table "public"."shoes" to "service_role";

grant update on table "public"."shoes" to "service_role";

grant delete on table "public"."store_cities" to "anon";

grant insert on table "public"."store_cities" to "anon";

grant select on table "public"."store_cities" to "anon";

grant update on table "public"."store_cities" to "anon";

grant delete on table "public"."store_cities" to "authenticated";

grant insert on table "public"."store_cities" to "authenticated";

grant select on table "public"."store_cities" to "authenticated";

grant update on table "public"."store_cities" to "authenticated";

grant delete on table "public"."store_cities" to "service_role";

grant insert on table "public"."store_cities" to "service_role";

grant select on table "public"."store_cities" to "service_role";

grant update on table "public"."store_cities" to "service_role";

grant delete on table "public"."stories" to "anon";

grant insert on table "public"."stories" to "anon";

grant select on table "public"."stories" to "anon";

grant update on table "public"."stories" to "anon";

grant delete on table "public"."stories" to "authenticated";

grant insert on table "public"."stories" to "authenticated";

grant select on table "public"."stories" to "authenticated";

grant update on table "public"."stories" to "authenticated";

grant delete on table "public"."stories" to "service_role";

grant insert on table "public"."stories" to "service_role";

grant select on table "public"."stories" to "service_role";

grant update on table "public"."stories" to "service_role";

grant delete on table "public"."territory_polygons" to "anon";

grant insert on table "public"."territory_polygons" to "anon";

grant select on table "public"."territory_polygons" to "anon";

grant update on table "public"."territory_polygons" to "anon";

grant delete on table "public"."territory_polygons" to "authenticated";

grant insert on table "public"."territory_polygons" to "authenticated";

grant select on table "public"."territory_polygons" to "authenticated";

grant update on table "public"."territory_polygons" to "authenticated";

grant delete on table "public"."territory_polygons" to "service_role";

grant insert on table "public"."territory_polygons" to "service_role";

grant select on table "public"."territory_polygons" to "service_role";

grant update on table "public"."territory_polygons" to "service_role";

grant delete on table "public"."training_plans" to "anon";

grant insert on table "public"."training_plans" to "anon";

grant select on table "public"."training_plans" to "anon";

grant update on table "public"."training_plans" to "anon";

grant delete on table "public"."training_plans" to "authenticated";

grant insert on table "public"."training_plans" to "authenticated";

grant select on table "public"."training_plans" to "authenticated";

grant update on table "public"."training_plans" to "authenticated";

grant delete on table "public"."training_plans" to "service_role";

grant insert on table "public"."training_plans" to "service_role";

grant select on table "public"."training_plans" to "service_role";

grant update on table "public"."training_plans" to "service_role";

grant delete on table "public"."user_awards" to "anon";

grant insert on table "public"."user_awards" to "anon";

grant select on table "public"."user_awards" to "anon";

grant update on table "public"."user_awards" to "anon";

grant delete on table "public"."user_awards" to "authenticated";

grant insert on table "public"."user_awards" to "authenticated";

grant select on table "public"."user_awards" to "authenticated";

grant update on table "public"."user_awards" to "authenticated";

grant delete on table "public"."user_awards" to "service_role";

grant insert on table "public"."user_awards" to "service_role";

grant select on table "public"."user_awards" to "service_role";

grant update on table "public"."user_awards" to "service_role";

grant delete on table "public"."weekly_consistency" to "anon";

grant insert on table "public"."weekly_consistency" to "anon";

grant select on table "public"."weekly_consistency" to "anon";

grant update on table "public"."weekly_consistency" to "anon";

grant delete on table "public"."weekly_consistency" to "authenticated";

grant insert on table "public"."weekly_consistency" to "authenticated";

grant select on table "public"."weekly_consistency" to "authenticated";

grant update on table "public"."weekly_consistency" to "authenticated";

grant delete on table "public"."weekly_consistency" to "service_role";

grant insert on table "public"."weekly_consistency" to "service_role";

grant select on table "public"."weekly_consistency" to "service_role";

grant update on table "public"."weekly_consistency" to "service_role";

grant delete on table "public"."weight_logs" to "anon";

grant insert on table "public"."weight_logs" to "anon";

grant select on table "public"."weight_logs" to "anon";

grant update on table "public"."weight_logs" to "anon";

grant delete on table "public"."weight_logs" to "authenticated";

grant insert on table "public"."weight_logs" to "authenticated";

grant select on table "public"."weight_logs" to "authenticated";

grant update on table "public"."weight_logs" to "authenticated";

grant delete on table "public"."weight_logs" to "service_role";

grant insert on table "public"."weight_logs" to "service_role";

grant select on table "public"."weight_logs" to "service_role";

grant update on table "public"."weight_logs" to "service_role";


  create policy "events: empire builder only"
  on "public"."events"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.subscription_tier = 'empire-builder'::text) AND ((profiles.subscription_expires_at IS NULL) OR (profiles.subscription_expires_at > now()))))));



