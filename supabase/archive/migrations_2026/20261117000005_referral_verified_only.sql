-- Invite reward pays only on the server-verified distance (in case
-- 20261117000003 was already pushed with the version that also read the
-- phone's distance_m). Same function and trigger, redefined.

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
