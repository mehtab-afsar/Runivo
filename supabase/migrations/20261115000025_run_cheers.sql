-- ============================================================
-- Cheers: send a friend who is running right now a quick cheer.
--
-- Who can cheer whom follows Live Run Sharing exactly: the runner has sharing
-- on, the two follow each other, and the runner's live position is fresh. A
-- block either way stops it. One cheer per friend per run; at most 30 cheers
-- an hour from one sender. Messages come from a fixed list, never free text,
-- so a cheer can't carry abuse.
--
-- The runner's app hears about it through realtime (and says it out loud as a
-- voice cue); a notification row gives the lock-screen push and the inbox
-- entry. After the run, the cheers show on the activity (run_id = runs.id).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.run_cheers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      text        NOT NULL,
  to_user     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_user   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message     text        NOT NULL CHECK (message IN ('go', 'pace', 'home', 'zone', 'clap')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  thanked_at  timestamptz,
  UNIQUE (run_id, from_user)
);
CREATE INDEX IF NOT EXISTS run_cheers_to_run_idx ON public.run_cheers (to_user, run_id);
CREATE INDEX IF NOT EXISTS run_cheers_from_recent_idx ON public.run_cheers (from_user, created_at DESC);

ALTER TABLE public.run_cheers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "run_cheers: sender and runner read" ON public.run_cheers;
CREATE POLICY "run_cheers: sender and runner read" ON public.run_cheers
  FOR SELECT TO authenticated USING (auth.uid() IN (to_user, from_user));
-- Writes only through send_cheer / thank_cheer.
REVOKE ALL ON public.run_cheers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.run_cheers TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.run_cheers;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- 'cheer' notifications (the lock-screen push while running).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'kudos', 'comment', 'territory_claimed', 'territory_lost', 'territory_captured', 'zone_attacked',
  'zone_fading', 'event_reminder', 'new_event', 'club_join', 'club_invite', 'streak', 'streak_risk',
  'system', 'follow', 'challenge', 'achievement', 'mission_complete', 'rank_up', 'pace_cap',
  'pace_cap_near', 'run_reminder', 'weekly_summary', 'campaign', 'cheer'
));

/** The words a cheer says, given the runner's name. Kept in step with the app (cheers.ts). */
CREATE OR REPLACE FUNCTION public.cheer_text(p_message text, p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_message
    WHEN 'go'   THEN 'Go ' || COALESCE(NULLIF(p_name, ''), 'you') || '!'
    WHEN 'pace' THEN 'Keep that pace'
    WHEN 'home' THEN 'Bring it home'
    WHEN 'zone' THEN 'Take that zone'
    ELSE 'Clap clap!'
  END $$;

/**
 * Send a cheer to a friend who is running now.
 * Returns 'sent', 'already' (one per run), 'not_live', 'too_many' or 'bad_message'.
 */
CREATE OR REPLACE FUNCTION public.send_cheer(p_to uuid, p_message text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_run    text;
  v_from   text;
  v_to     text;
  v_id     uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_message IS NULL OR p_message NOT IN ('go', 'pace', 'home', 'zone', 'clap') THEN RETURN 'bad_message'; END IF;
  IF p_to IS NULL OR p_to = v_me THEN RETURN 'not_live'; END IF;

  -- Same rule as reading the runner's live position (20260811000004), with a
  -- little slack for a cheer composed on a slow connection.
  SELECT lp.run_id INTO v_run
    FROM live_run_positions lp
    JOIN profiles p ON p.id = lp.user_id
   WHERE lp.user_id = p_to
     AND lp.updated_at > now() - interval '60 seconds'
     AND p.live_run_sharing_enabled
     AND EXISTS (SELECT 1 FROM followers WHERE follower_id = v_me AND following_id = p_to)
     AND EXISTS (SELECT 1 FROM followers WHERE follower_id = p_to AND following_id = v_me)
     AND NOT EXISTS (
       SELECT 1 FROM user_blocks
        WHERE (blocker_id = p_to AND blocked_id = v_me) OR (blocker_id = v_me AND blocked_id = p_to)
     );
  IF v_run IS NULL THEN RETURN 'not_live'; END IF;

  IF (SELECT count(*) FROM run_cheers WHERE from_user = v_me AND created_at > now() - interval '1 hour') >= 30 THEN
    RETURN 'too_many';
  END IF;

  INSERT INTO run_cheers (run_id, to_user, from_user, message)
  VALUES (v_run, p_to, v_me, p_message)
  ON CONFLICT (run_id, from_user) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN 'already'; END IF;

  SELECT username INTO v_from FROM profiles WHERE id = v_me;
  SELECT username INTO v_to   FROM profiles WHERE id = p_to;
  INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
  VALUES (p_to, 'cheer', COALESCE(v_from, 'A friend') || ' cheered you on',
          cheer_text(p_message, v_to), '/run', 'cheer:' || v_id::text);

  RETURN 'sent';
END;
$$;

/** The runner thanks a cheer (shown to the sender on their copy). */
CREATE OR REPLACE FUNCTION public.thank_cheer(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    UPDATE run_cheers SET thanked_at = COALESCE(thanked_at, now())
     WHERE id = p_id AND to_user = auth.uid()
     RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM t);
$$;

REVOKE ALL ON FUNCTION public.send_cheer(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.thank_cheer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_cheer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.thank_cheer(uuid) TO authenticated;
