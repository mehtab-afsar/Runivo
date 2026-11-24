-- Invite friends (mock Search: "Invite friends · get 50 PACE each").
--
-- Every runner has a short invite code. A new runner (account under 14 days
-- old) can use one code, once, and not their own or a blocked runner's. When
-- the new runner finishes their first scored run of at least 1 km (server-verified distance), both get
-- 50 PACE through credit_pace_capped (same weekly cap and the same
-- one-time-per-key ledger as every other PACE source), and the inviter is told.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referrals (
  referred_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referred_id <> referrer_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referrals_own ON public.referrals;
CREATE POLICY referrals_own ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM anon, authenticated;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'kudos', 'comment', 'territory_claimed', 'territory_lost', 'territory_captured', 'zone_attacked',
  'zone_fading', 'event_reminder', 'new_event', 'club_join', 'club_invite', 'streak', 'streak_risk',
  'system', 'follow', 'challenge', 'achievement', 'mission_complete', 'rank_up', 'pace_cap',
  'pace_cap_near', 'run_reminder', 'weekly_summary', 'campaign', 'cheer', 'referral'
));

ALTER TABLE public.pace_awards DROP CONSTRAINT IF EXISTS pace_awards_source_check;
ALTER TABLE public.pace_awards ADD CONSTRAINT pace_awards_source_check CHECK (source IN (
  'run', 'mission', 'campaign', 'adjustment', 'territory_event', 'referral'
));

/** Your invite code, made on first ask: 8 characters, no look-alikes (0/O, 1/I/L). */
CREATE OR REPLACE FUNCTION public.my_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me   uuid := auth.uid();
  v_code text;
  v_abc  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT referral_code INTO v_code FROM profiles WHERE id = v_me;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  FOR i IN 1..10 LOOP
    SELECT string_agg(substr(v_abc, 1 + (get_byte(b, k) % length(v_abc)), 1), '')
      INTO v_code
      FROM (SELECT gen_random_bytes(8) AS b) r, generate_series(0, 7) k;
    BEGIN
      UPDATE profiles SET referral_code = v_code WHERE id = v_me AND referral_code IS NULL;
      RETURN (SELECT referral_code FROM profiles WHERE id = v_me);
    EXCEPTION WHEN unique_violation THEN
      -- another runner has it; try again
    END;
  END LOOP;
  RAISE EXCEPTION 'could not make an invite code';
END;
$$;
REVOKE ALL ON FUNCTION public.my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_code() TO authenticated;

/** A new runner uses an invite code. Returns ok, invalid, own_code, too_late, already, blocked. */
CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_owner   uuid;
  v_created timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO v_owner FROM profiles WHERE referral_code = upper(trim(p_code));
  IF v_owner IS NULL THEN RETURN 'invalid'; END IF;
  IF v_owner = v_me THEN RETURN 'own_code'; END IF;
  SELECT created_at INTO v_created FROM auth.users WHERE id = v_me;
  IF v_created IS NULL OR v_created < now() - interval '14 days' THEN RETURN 'too_late'; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_me) THEN RETURN 'already'; END IF;
  IF public.is_blocked_between(v_me, v_owner) THEN RETURN 'blocked'; END IF;
  INSERT INTO referrals (referred_id, referrer_id) VALUES (v_me, v_owner) ON CONFLICT DO NOTHING;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;

/** Pays both runners once the invited runner's first scored run (1 km+) lands. */
CREATE OR REPLACE FUNCTION public.award_referral_on_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref referrals%ROWTYPE;
  v_name text;
BEGIN
  -- Only the server-verified distance (process-run-territory) counts, never the
  -- distance the phone wrote, so a made-up run can't pay out the invite.
  IF COALESCE(NEW.verified_distance_m, 0) < 1000 OR NEW.excluded
     OR NEW.integrity_status NOT IN ('ok', 'cleared') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO ref FROM referrals WHERE referred_id = NEW.user_id AND rewarded_at IS NULL FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NEW; END IF;
  BEGIN
    UPDATE referrals SET rewarded_at = now() WHERE referred_id = ref.referred_id;
    PERFORM public.credit_pace_capped(ref.referred_id, 50, 'referral', ref.referred_id::text || ':joined');
    PERFORM public.credit_pace_capped(ref.referrer_id, 50, 'referral', ref.referred_id::text || ':inviter');
    SELECT username INTO v_name FROM profiles WHERE id = ref.referred_id;
    INSERT INTO notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (ref.referrer_id, 'referral', COALESCE(v_name, 'Your friend') || ' finished their first run',
            'You both got 50 PACE for the invite.', '/store', 'referral:' || ref.referred_id::text);
  EXCEPTION WHEN OTHERS THEN
    -- Never block saving a run over an invite reward.
    RAISE WARNING 'referral award failed for %: %', ref.referred_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.award_referral_on_run() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS runs_award_referral ON public.runs;
CREATE TRIGGER runs_award_referral
  AFTER INSERT OR UPDATE OF verified_distance_m, integrity_status, excluded ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_on_run();
