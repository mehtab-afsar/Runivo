-- ============================================================
-- Fraud review queue for partner rewards (PRD S6)
-- ============================================================
-- A redemption from an account with GPS-flagged runs (B7: teleport or
-- vehicle speed, flagged or under appeal) in the last 30 days is held: the
-- code is kept back and the partner is not billed until Runivo staff
-- approve it. Rejecting refunds the PACE and returns the code to the pool.
-- Staff work the queue with the service role (fraud_review_queue,
-- review_redemption); partners see held counts in billable_redemptions.
-- ============================================================

ALTER TABLE public.pace_redemptions
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'clear'
    CHECK (review_status IN ('clear', 'held', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz;

-- Held codes live apart from the redemption (which its runner can read):
-- no policies, so only the service role and these functions see them.
CREATE TABLE IF NOT EXISTS public.redemption_holds (
  redemption_id uuid PRIMARY KEY,
  code          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.redemption_holds ENABLE ROW LEVEL SECURITY;

-- A runner can't read a pool code that is still held for review.
DROP POLICY IF EXISTS reward_codes_read_own ON public.reward_codes;
CREATE POLICY reward_codes_read_own ON public.reward_codes
  FOR SELECT TO authenticated USING (
    assigned_to = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.pace_redemptions red
       WHERE red.user_id = auth.uid() AND red.reward_id = reward_codes.reward_id AND red.review_status = 'held'
    )
  );

-- Why an account's redemptions should be checked, or NULL.
CREATE OR REPLACE FUNCTION public.redemption_risk_reason(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN n > 0 THEN n || ' GPS-flagged ' || CASE WHEN n = 1 THEN 'run' ELSE 'runs' END || ' in 30 days (' || reasons || ')' END
    FROM (SELECT count(*) AS n, string_agg(DISTINCT integrity_reason, ', ') AS reasons
            FROM public.runs
           WHERE user_id = p_user_id AND integrity_status IN ('flagged', 'appealed')
             AND started_at > now() - interval '30 days') x;
$$;
REVOKE ALL ON FUNCTION public.redemption_risk_reason(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hold_risky_redemption()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_reason text := public.redemption_risk_reason(NEW.user_id);
BEGIN
  IF v_reason IS NOT NULL THEN
    NEW.review_status := 'held';
    NEW.review_reason := v_reason;
    INSERT INTO public.redemption_holds (redemption_id, code) VALUES (NEW.id, NEW.fulfillment_code)
    ON CONFLICT (redemption_id) DO UPDATE SET code = EXCLUDED.code;
    NEW.fulfillment_code := NULL;
    NEW.fulfilled_at  := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hold_risky_redemption ON public.pace_redemptions;
CREATE TRIGGER trg_hold_risky_redemption BEFORE INSERT ON public.pace_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.hold_risky_redemption();

-- The queue, oldest first; optionally one partner's rewards only.
CREATE OR REPLACE FUNCTION public.fraud_review_queue(p_partner_id uuid DEFAULT NULL)
RETURNS TABLE(redemption_id uuid, created_at timestamptz, username text, account_age_days integer, total_runs integer,
              reward_title text, partner_name text, pace_spent integer, review_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT red.id, red.created_at, p.username, (now()::date - p.created_at::date), COALESCE(p.total_runs, 0),
         r.title, pt.name, red.pace_spent, red.review_reason
    FROM public.pace_redemptions red
    JOIN public.pace_store_rewards r ON r.id = red.reward_id
    JOIN public.profiles p ON p.id = red.user_id
    LEFT JOIN public.partners pt ON pt.id = r.partner_id
   WHERE red.review_status = 'held' AND (p_partner_id IS NULL OR r.partner_id = p_partner_id)
   ORDER BY red.created_at;
$$;

-- Approve: release the code. Reject: refund PACE, return the code and stock.
CREATE OR REPLACE FUNCTION public.review_redemption(p_redemption_id uuid, p_approve boolean)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE red public.pace_redemptions%ROWTYPE; r public.pace_store_rewards%ROWTYPE; v_code text;
BEGIN
  SELECT * INTO red FROM public.pace_redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF red.review_status <> 'held' THEN RETURN 'not_held'; END IF;
  SELECT * INTO r FROM public.pace_store_rewards WHERE id = red.reward_id;
  SELECT code INTO v_code FROM public.redemption_holds WHERE redemption_id = red.id;
  DELETE FROM public.redemption_holds WHERE redemption_id = red.id;

  IF p_approve THEN
    UPDATE public.pace_redemptions
       SET review_status = 'approved', reviewed_at = now(),
           fulfillment_code = v_code, fulfilled_at = CASE WHEN v_code IS NOT NULL THEN now() END
     WHERE id = red.id;
    RETURN 'approved';
  END IF;

  PERFORM set_config('runivo.trusted_writer', 'on', true);
  UPDATE public.profiles SET pace_balance = pace_balance + red.pace_spent WHERE id = red.user_id;
  PERFORM set_config('runivo.trusted_writer', 'off', true);
  IF v_code IS NOT NULL AND r.code_mode = 'pool' THEN
    UPDATE public.reward_codes SET assigned_to = NULL, assigned_at = NULL
     WHERE reward_id = r.id AND assigned_to = red.user_id AND code = v_code;
  END IF;
  IF r.stock IS NOT NULL THEN UPDATE public.pace_store_rewards SET stock = stock + 1 WHERE id = r.id; END IF;
  UPDATE public.pace_redemptions SET review_status = 'rejected', reviewed_at = now() WHERE id = red.id;
  RETURN 'rejected';
END;
$$;

-- What a partner is billed for in a month: redemptions not held or rejected.
CREATE OR REPLACE FUNCTION public.billable_redemptions(p_partner_id uuid, p_month date)
RETURNS TABLE(billable integer, held integer, rejected integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*) FILTER (WHERE red.review_status IN ('clear', 'approved'))::int,
         count(*) FILTER (WHERE red.review_status = 'held')::int,
         count(*) FILTER (WHERE red.review_status = 'rejected')::int
    FROM public.pace_redemptions red
    JOIN public.pace_store_rewards r ON r.id = red.reward_id
   WHERE r.partner_id = p_partner_id
     AND red.created_at >= date_trunc('month', p_month) AND red.created_at < date_trunc('month', p_month) + interval '1 month';
$$;

REVOKE ALL ON FUNCTION public.fraud_review_queue(uuid), public.review_redemption(uuid, boolean),
  public.billable_redemptions(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fraud_review_queue(uuid), public.review_redemption(uuid, boolean),
  public.billable_redemptions(uuid, date) TO service_role;

-- My rewards: held ones show as under review, rejected ones as refunded.
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
           WHEN red.review_status = 'held' THEN 'review'
           WHEN red.review_status = 'rejected' THEN 'refunded'
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
