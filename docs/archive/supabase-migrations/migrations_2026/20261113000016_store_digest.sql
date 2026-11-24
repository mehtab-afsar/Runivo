-- Store and messaging batch:
--   S4  sponsored challenges: a brand funds a reward for finishing a challenge
--   S5  nudges: a reward you can afford is about to expire or run out
--   N5  weekly email digest rows, for runners who turned push off

-- ── S4 ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsored_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  brand       text NOT NULL,
  brand_color text,
  title       text NOT NULL CHECK (length(title) BETWEEN 3 AND 80),
  description text,
  metric      text NOT NULL CHECK (metric IN ('distance_km', 'zones', 'active_days')),
  target      numeric NOT NULL CHECK (target > 0),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL CHECK (ends_at > starts_at),
  reward_id   uuid NOT NULL REFERENCES public.pace_store_rewards(id) ON DELETE RESTRICT,
  countries   text[],
  status      text NOT NULL DEFAULT 'live' CHECK (status IN ('draft', 'live', 'ended')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sponsored_challenge_entries (
  challenge_id uuid NOT NULL REFERENCES public.sponsored_challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  code         text,
  PRIMARY KEY (challenge_id, user_id)
);
ALTER TABLE public.sponsored_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_challenge_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sc_read ON public.sponsored_challenges;
CREATE POLICY sc_read ON public.sponsored_challenges FOR SELECT TO authenticated USING (status = 'live');
DROP POLICY IF EXISTS sce_own ON public.sponsored_challenge_entries;
CREATE POLICY sce_own ON public.sponsored_challenge_entries FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Progress between the later of the start and when you joined, and the end.
CREATE OR REPLACE FUNCTION public.sponsored_progress(p_challenge uuid, p_user uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE c.metric
    WHEN 'distance_km' THEN COALESCE((SELECT round(sum(r.distance_m) / 1000.0, 1) FROM runs r
           WHERE r.user_id = p_user AND NOT COALESCE(r.excluded, false)
             AND COALESCE(r.activity_type, 'run') = ANY (ARRAY['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'])
             AND r.started_at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
    WHEN 'active_days' THEN COALESCE((SELECT count(DISTINCT r.started_at::date) FROM runs r
           WHERE r.user_id = p_user AND NOT COALESCE(r.excluded, false)
             AND r.started_at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
    ELSE COALESCE((SELECT count(*) FROM zone_events z
           WHERE z.user_id = p_user AND z.kind IN ('claimed', 'stolen')
             AND z.at BETWEEN GREATEST(c.starts_at, e.joined_at) AND c.ends_at), 0)
  END
  FROM sponsored_challenges c
  JOIN sponsored_challenge_entries e ON e.challenge_id = c.id AND e.user_id = p_user
  WHERE c.id = p_challenge;
$$;

CREATE OR REPLACE FUNCTION public.list_sponsored_challenges()
RETURNS TABLE (id uuid, brand text, brand_color text, title text, description text, metric text, target numeric,
               starts_at timestamptz, ends_at timestamptz, reward_title text, reward_value text,
               joined boolean, progress numeric, completed boolean, code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.brand, c.brand_color, c.title, c.description, c.metric, c.target, c.starts_at, c.ends_at,
         r.title, r.value_label,
         e.user_id IS NOT NULL, CASE WHEN e.user_id IS NULL THEN 0 ELSE sponsored_progress(c.id, auth.uid()) END,
         e.completed_at IS NOT NULL, e.code
    FROM sponsored_challenges c
    JOIN pace_store_rewards r ON r.id = c.reward_id
    LEFT JOIN sponsored_challenge_entries e ON e.challenge_id = c.id AND e.user_id = auth.uid()
    JOIN profiles p ON p.id = auth.uid()
   WHERE c.status = 'live' AND c.ends_at > now() - interval '7 days'
     AND (c.countries IS NULL OR p.country = ANY (c.countries))
   ORDER BY (e.completed_at IS NOT NULL), c.ends_at;
$$;

CREATE OR REPLACE FUNCTION public.join_sponsored_challenge(p_challenge uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO sponsored_challenge_entries (challenge_id, user_id)
  SELECT id, auth.uid() FROM sponsored_challenges WHERE id = p_challenge AND status = 'live' AND ends_at > now()
  ON CONFLICT DO NOTHING;
$$;

-- Finished: hand out one of the brand's codes (once).
CREATE OR REPLACE FUNCTION public.claim_sponsored_reward(p_challenge uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c sponsored_challenges%ROWTYPE;
  e sponsored_challenge_entries%ROWTYPE;
  v_code text;
BEGIN
  SELECT * INTO c FROM sponsored_challenges WHERE id = p_challenge;
  SELECT * INTO e FROM sponsored_challenge_entries WHERE challenge_id = p_challenge AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'join the challenge first'; END IF;
  IF e.code IS NOT NULL THEN RETURN e.code; END IF;
  IF sponsored_progress(p_challenge, auth.uid()) < c.target THEN RAISE EXCEPTION 'not finished yet'; END IF;
  UPDATE reward_codes SET assigned_to = auth.uid(), assigned_at = now()
   WHERE id = (SELECT id FROM reward_codes WHERE reward_id = c.reward_id AND assigned_to IS NULL LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING code INTO v_code;
  IF v_code IS NULL THEN
    SELECT static_code INTO v_code FROM pace_store_rewards WHERE id = c.reward_id AND code_mode = 'static';
  END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'the brand has run out of codes; we''ll let you know'; END IF;
  UPDATE sponsored_challenge_entries SET completed_at = now(), code = v_code WHERE challenge_id = p_challenge AND user_id = auth.uid();
  RETURN v_code;
END;
$$;

-- ── S5 ──────────────────────────────────────────────────────────────────────
-- At 18:00 local: one nudge for a live reward you can afford, haven't redeemed,
-- and that ends within 3 days or has 10 or fewer codes left.
CREATE OR REPLACE FUNCTION public.send_reward_nudges(p_now timestamptz DEFAULT now())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_sent int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.id) p.id AS uid, w.id AS rid, w.brand, w.value_label,
           (w.expires_at IS NOT NULL AND w.expires_at < p_now + interval '3 days') AS expiring,
           w.stock
      FROM profiles p
      JOIN pace_store_rewards w ON w.status = 'available'
           AND (w.starts_at IS NULL OR w.starts_at <= p_now)
           AND (w.expires_at IS NULL OR w.expires_at > p_now)
           AND p.pace_balance >= w.pace_cost
           AND (NOT w.plus_only OR p.subscription_tier = 'premium')
           AND (w.countries IS NULL OR p.country = ANY (w.countries))
           AND ((w.expires_at IS NOT NULL AND w.expires_at < p_now + interval '3 days') OR (w.stock IS NOT NULL AND w.stock BETWEEN 1 AND 10))
     WHERE p.notifications_enabled AND p.offers_enabled
       AND extract(hour FROM local_time(p.timezone, p_now)) = 18
       AND NOT EXISTS (SELECT 1 FROM pace_redemptions x WHERE x.user_id = p.id AND x.reward_id = w.id)
     ORDER BY p.id, w.expires_at NULLS LAST
  LOOP
    IF queue_notification(r.uid, 'campaign',
         CASE WHEN r.expiring THEN r.brand || ' ' || r.value_label || ' ends soon' ELSE 'Only ' || r.stock || ' left: ' || r.brand || ' ' || r.value_label END,
         'You have the PACE for it.', '/store', 'reward_nudge:' || r.rid, false, p_now) THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_hourly_notifications(p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'zone_fading',    send_zone_fading(p_now),
    'streak_risk',    send_streak_risk(p_now),
    'run_reminder',   send_run_reminders_local(p_now),
    'weekly_summary', send_weekly_summaries_local(p_now),
    'campaigns',      send_due_campaigns(p_now),
    'reward_nudges',  send_reward_nudges(p_now)
  );
END;
$$;

-- ── N5 ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_digest_enabled boolean NOT NULL DEFAULT true;

-- One row per runner who has push off but wants the digest: last week's numbers.
CREATE OR REPLACE FUNCTION public.weekly_digest_rows(p_now timestamptz DEFAULT now())
RETURNS TABLE (user_id uuid, email text, username text, km numeric, runs int, zones_claimed int, zones_lost int, fading int, pace_earned int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, u.email::text, p.username,
    COALESCE((SELECT round(sum(r.distance_m) / 1000.0, 1) FROM runs r WHERE r.user_id = p.id AND NOT COALESCE(r.excluded, false) AND r.started_at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM runs r WHERE r.user_id = p.id AND NOT COALESCE(r.excluded, false) AND r.started_at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM zone_events z WHERE z.user_id = p.id AND z.kind IN ('claimed', 'stolen') AND z.at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM zone_events z WHERE z.prev_owner_id = p.id AND z.kind = 'stolen' AND z.at > p_now - interval '7 days'), 0),
    COALESCE((SELECT count(*)::int FROM territory_polygons t WHERE t.owner_id = p.id AND t.freshness < 40), 0),
    COALESCE(p.pace_weekly_earned, 0)
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE NOT p.notifications_enabled AND p.email_digest_enabled AND p.weekly_summary_enabled
    AND u.email IS NOT NULL AND u.email NOT LIKE '%@privaterelay.appleid.com'
    AND p.last_run_date >= (p_now - interval '60 days')::date;
$$;

CREATE OR REPLACE FUNCTION public.set_email_digest(p_on boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE profiles SET email_digest_enabled = p_on WHERE id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.get_email_digest()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email_digest_enabled FROM profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.sponsored_progress(uuid, uuid), public.list_sponsored_challenges(), public.join_sponsored_challenge(uuid),
  public.claim_sponsored_reward(uuid), public.send_reward_nudges(timestamptz), public.run_hourly_notifications(timestamptz),
  public.weekly_digest_rows(timestamptz), public.set_email_digest(boolean), public.get_email_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_sponsored_challenges(), public.join_sponsored_challenge(uuid), public.claim_sponsored_reward(uuid),
  public.set_email_digest(boolean), public.get_email_digest() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_hourly_notifications(timestamptz), public.weekly_digest_rows(timestamptz), public.send_reward_nudges(timestamptz) TO service_role;
