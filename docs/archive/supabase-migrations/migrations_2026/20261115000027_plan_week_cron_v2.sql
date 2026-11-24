-- ============================================================
-- The weekly job (20260515000065) moved every active plan on a week each
-- Monday, counted from when the row was created, and marked it completed
-- once week_current reached weeks_total. Plans built by the plan engine
-- (plan_data.version = 2: the plan builder, onboarding, PaceX) start on the
-- coming Monday and date every session, and the app keeps week_current in
-- step itself. Counting from created_at could finish such a plan a week
-- before race day. The job now leaves version-2 plans alone; the app marks
-- them completed after race week.
-- ============================================================

CREATE OR REPLACE FUNCTION public.advance_training_plan_week()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE training_plans
  SET    week_current = week_current + 1,
         updated_at   = now()
  WHERE  status       = 'active'
    AND  COALESCE(plan_data ->> 'version', '1') <> '2'
    AND  week_current < weeks_total
    AND  created_at <= now() - (week_current * INTERVAL '7 days');

  UPDATE training_plans
  SET    status     = 'completed',
         updated_at = now()
  WHERE  status       = 'active'
    AND  COALESCE(plan_data ->> 'version', '1') <> '2'
    AND  week_current >= weeks_total;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_training_plan_week() FROM PUBLIC, anon, authenticated;
