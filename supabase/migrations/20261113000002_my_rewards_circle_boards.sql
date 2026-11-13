-- ============================================================
-- My rewards, and Following / My clubs leaderboards
-- ============================================================
-- 1. My rewards: every redemption with its code, how to use it, and a status
--    (pending, unused, used, expired). Runners mark a code used themselves.
-- 2. Circle boards: the same metrics as get_leaderboard, ranked among you and
--    the runners you follow, or you and members of your clubs.
-- ============================================================

ALTER TABLE public.pace_redemptions ADD COLUMN IF NOT EXISTS used_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_my_rewards()
RETURNS TABLE(
  redemption_id uuid, reward_id uuid, brand text, title text, value_label text, brand_color text,
  code text, how_to_use text, pace_spent integer, redeemed_at timestamptz, used_at timestamptz,
  expires_at timestamptz, status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT red.id, r.id, r.brand, r.title, r.value_label, r.brand_color,
         red.fulfillment_code, r.how_to_use, red.pace_spent, red.created_at, red.used_at, r.expires_at,
         CASE
           WHEN red.used_at IS NOT NULL THEN 'used'
           WHEN r.expires_at IS NOT NULL AND r.expires_at < now() THEN 'expired'
           WHEN red.fulfillment_code IS NULL THEN 'pending'
           ELSE 'unused'
         END
    FROM public.pace_redemptions red
    JOIN public.pace_store_rewards r ON r.id = red.reward_id
   WHERE red.user_id = auth.uid()
   ORDER BY red.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.set_reward_used(p_redemption_id uuid, p_used boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.pace_redemptions
     SET used_at = CASE WHEN p_used THEN COALESCE(used_at, now()) ELSE NULL END
   WHERE id = p_redemption_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

-- Who is on a circle board for this viewer: themselves, plus following or club mates,
-- minus anyone blocked either way or muted.
CREATE OR REPLACE FUNCTION public.leaderboard_circle(p_viewer uuid, p_circle text)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_viewer
  UNION
  SELECT f.following_id FROM public.followers f
   WHERE p_circle = 'following' AND f.follower_id = p_viewer
  UNION
  SELECT m2.user_id FROM public.club_members m1
    JOIN public.club_members m2 ON m2.club_id = m1.club_id
   WHERE p_circle = 'clubs' AND m1.user_id = p_viewer
  EXCEPT
  SELECT public.hidden_user_ids(p_viewer);
$$;
REVOKE ALL ON FUNCTION public.leaderboard_circle(uuid, text) FROM PUBLIC, authenticated;

-- Ranks inside the circle; the viewer is always included when they have a value.
CREATE OR REPLACE FUNCTION public.get_circle_leaderboard(
  p_metric text,
  p_period text,
  p_circle text,
  p_limit  integer DEFAULT 100
)
RETURNS TABLE(user_id uuid, username text, runner_rank text, country text, value numeric, rank integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  PERFORM public.leaderboard_check_args(p_metric, p_period);
  IF p_circle NOT IN ('following', 'clubs') THEN
    RAISE EXCEPTION 'circle must be following or clubs' USING ERRCODE = '22023';
  END IF;
  IF v_uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT v.user_id, pr.username, COALESCE(pr.runner_rank, 'pacer'), pr.country,
         round(v.value, 1),
         (rank() OVER (ORDER BY v.value DESC))::integer
    FROM public.leaderboard_values(p_metric, p_period) v
    JOIN public.profiles pr ON pr.id = v.user_id
   WHERE v.user_id IN (SELECT public.leaderboard_circle(v_uid, p_circle))
   ORDER BY v.value DESC, pr.username
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_rewards(), public.set_reward_used(uuid, boolean),
  public.get_circle_leaderboard(text, text, text, integer) TO authenticated;
