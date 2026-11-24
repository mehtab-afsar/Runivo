-- ============================================================
-- Safety share (PRD R2): a live link for one activity that works without
-- the app. The runner starts it, sends the link to whoever they choose
-- (system share sheet), and the phone posts its position every ~15 s.
-- Anyone with the link sees the latest position until the activity ends;
-- the link stops showing location 30 minutes after the end, and always
-- 12 hours after it started. Only the safety-share edge function (service
-- role) reads it for viewers; there is no client read policy.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.safety_shares (
  token        text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id       text,
  sport        text NOT NULL DEFAULT 'run',
  started_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '12 hours',
  ended_at     timestamptz,
  lat          double precision,
  lng          double precision,
  position_at  timestamptz,
  distance_m   numeric,
  elapsed_sec  integer
);
CREATE INDEX IF NOT EXISTS safety_shares_user_idx ON public.safety_shares (user_id, started_at DESC);
ALTER TABLE public.safety_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "safety_shares: owner reads" ON public.safety_shares;
CREATE POLICY "safety_shares: owner reads" ON public.safety_shares FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Start a share; returns the token for the link. Ends any other open share of yours.
CREATE OR REPLACE FUNCTION public.start_safety_share(p_run_id text, p_sport text DEFAULT 'run')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  UPDATE public.safety_shares SET ended_at = now() WHERE user_id = v_uid AND ended_at IS NULL;
  IF (SELECT count(*) FROM public.safety_shares WHERE user_id = v_uid AND started_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'too many shares today' USING ERRCODE = '54000';
  END IF;
  -- 244 random bits; gen_random_uuid is core Postgres (no extension schema needed).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.safety_shares (token, user_id, run_id, sport)
  VALUES (v_token, v_uid, p_run_id, COALESCE(NULLIF(p_sport, ''), 'run'));
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_safety_share(p_token text, p_lat double precision, p_lng double precision, p_distance_m numeric, p_elapsed_sec integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad position' USING ERRCODE = '22023';
  END IF;
  UPDATE public.safety_shares
     SET lat = p_lat, lng = p_lng, position_at = now(), distance_m = GREATEST(0, p_distance_m), elapsed_sec = GREATEST(0, p_elapsed_sec)
   WHERE token = p_token AND user_id = auth.uid() AND ended_at IS NULL AND expires_at > now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_safety_share(p_token text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.safety_shares SET ended_at = COALESCE(ended_at, now())
   WHERE token = p_token AND user_id = auth.uid();
$$;

-- What a viewer of the link sees (called by the edge function with the service role).
CREATE OR REPLACE FUNCTION public.view_safety_share(p_token text)
RETURNS TABLE(username text, sport text, status text, lat double precision, lng double precision,
              position_at timestamptz, distance_m numeric, elapsed_sec integer, started_at timestamptz, ended_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.username, s.sport,
         CASE WHEN s.ended_at IS NOT NULL THEN 'finished'
              WHEN s.position_at IS NULL OR s.position_at < now() - interval '2 minutes' THEN 'no_signal'
              ELSE 'live' END,
         -- Location only while live or within 30 minutes of the end.
         CASE WHEN s.ended_at IS NULL OR s.ended_at > now() - interval '30 minutes' THEN s.lat END,
         CASE WHEN s.ended_at IS NULL OR s.ended_at > now() - interval '30 minutes' THEN s.lng END,
         s.position_at, s.distance_m, s.elapsed_sec, s.started_at, s.ended_at
    FROM public.safety_shares s JOIN public.profiles p ON p.id = s.user_id
   WHERE s.token = p_token AND s.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.view_safety_share(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_safety_share(text, text), public.update_safety_share(text, double precision, double precision, numeric, integer),
  public.end_safety_share(text) TO authenticated;
