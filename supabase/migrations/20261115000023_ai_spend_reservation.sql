-- PaceX spend cap that holds under parallel requests (security audit M12).
--
-- ai-coach checked "spent in the last 24 h < cap", then called the model, then
-- logged the cost. Ten requests sent at once all passed the check before any
-- cost was logged, so the $0.12/day cap could be overrun many times over.
--
-- Now each request first reserves a worst-case cost under a per-runner lock:
-- the check and the reservation are one step, so parallel requests queue and
-- each sees the others' reservations. The reservation is removed when the
-- request finishes (the real cost is logged as before). A reservation left by a
-- crashed request stops counting after 5 minutes.

ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS reservation boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ai_reserve_spend(
  p_user uuid, p_feature text, p_estimate_usd numeric, p_daily_cap_usd numeric, p_chat_cap_usd numeric
) RETURNS TABLE (reservation_id uuid, refused text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
  v_chat  numeric;
  v_id    uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_spend:' || p_user::text, 0));

  SELECT COALESCE(sum(cost_usd), 0),
         COALESCE(sum(cost_usd) FILTER (WHERE feature = 'coach_chat'), 0)
    INTO v_total, v_chat
    FROM public.ai_usage_log
   WHERE user_id = p_user
     AND created_at > now() - interval '24 hours'
     AND (NOT reservation OR created_at > now() - interval '5 minutes');

  IF v_total >= p_daily_cap_usd THEN
    RETURN QUERY SELECT NULL::uuid, 'daily_limit_reached'::text; RETURN;
  END IF;
  IF p_feature = 'coach_chat' AND v_chat >= p_chat_cap_usd THEN
    RETURN QUERY SELECT NULL::uuid, 'chat_limit_reached'::text; RETURN;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, feature, input_tokens, output_tokens, cost_usd, reservation)
  VALUES (p_user, p_feature, 0, 0, p_estimate_usd, true)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.ai_reserve_spend(uuid, text, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_reserve_spend(uuid, text, numeric, numeric, numeric) TO service_role;
