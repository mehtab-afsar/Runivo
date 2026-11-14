-- N3: quiet hours and the daily nudge limit are the runner's to change.
-- Defaults keep today's behaviour (22:00–07:00 local, 3 nudges a day).
-- quiet_start = quiet_end means no quiet hours. Urgent notifications
-- (zone stolen, safety) ignore both, as before.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quiet_start       smallint NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS quiet_end         smallint NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS daily_nudge_limit smallint NOT NULL DEFAULT 3;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_quiet_hours_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_quiet_hours_chk
  CHECK (quiet_start BETWEEN 0 AND 23 AND quiet_end BETWEEN 0 AND 23 AND daily_nudge_limit BETWEEN 0 AND 10);

CREATE OR REPLACE FUNCTION public.in_quiet_hours(p_hour int, p_start int, p_end int)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_start = p_end THEN false
    WHEN p_start < p_end THEN p_hour >= p_start AND p_hour < p_end
    ELSE p_hour >= p_start OR p_hour < p_end
  END;
$$;

CREATE OR REPLACE FUNCTION public.queue_notification(
  p_user_id    uuid,
  p_type       text,
  p_title      text,
  p_body       text,
  p_action_url text,
  p_dedupe_key text,
  p_urgent     boolean     DEFAULT false,
  p_now        timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz    text;
  v_qs    int;
  v_qe    int;
  v_limit int;
  v_local timestamp;
  v_today int;
BEGIN
  SELECT timezone, quiet_start, quiet_end, daily_nudge_limit
    INTO v_tz, v_qs, v_qe, v_limit
    FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  v_local := local_time(v_tz, p_now);

  IF NOT p_urgent THEN
    IF in_quiet_hours(extract(hour FROM v_local)::int, v_qs, v_qe) THEN
      RETURN false;
    END IF;
    SELECT count(*) INTO v_today
      FROM notifications
     WHERE user_id = p_user_id AND is_nudge
       AND created_at >= (date_trunc('day', v_local) AT TIME ZONE COALESCE(NULLIF(v_tz, ''), 'UTC'));
    IF v_today >= v_limit THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key, is_nudge, created_at)
  VALUES (p_user_id, p_type, p_title, p_body, p_action_url, p_dedupe_key, NOT p_urgent, p_now)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_notification_prefs(p_quiet_start int, p_quiet_end int, p_daily_limit int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_quiet_start NOT BETWEEN 0 AND 23 OR p_quiet_end NOT BETWEEN 0 AND 23 OR p_daily_limit NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'out of range';
  END IF;
  UPDATE profiles SET quiet_start = p_quiet_start, quiet_end = p_quiet_end, daily_nudge_limit = p_daily_limit
   WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_notification_prefs()
RETURNS TABLE (quiet_start int, quiet_end int, daily_limit int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT quiet_start, quiet_end, daily_nudge_limit FROM profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.set_notification_prefs(int, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_notification_prefs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_notification_prefs(int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_prefs() TO authenticated;
