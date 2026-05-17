-- Weekly plan adaptation: advance week_current and trigger adapt_plan every Monday at 06:00 UTC.
-- Requires the pg_cron extension (enabled on Supabase Pro plans).
-- If pg_cron is unavailable, call adapt_plan from the client on Monday login instead.

-- Function called by cron: advances week_current for active plans that are on track
CREATE OR REPLACE FUNCTION advance_training_plan_week()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE training_plans
  SET    week_current = week_current + 1,
         updated_at   = now()
  WHERE  status       = 'active'
    AND  week_current < weeks_total
    -- Only advance if the plan was created at least (week_current * 7) days ago,
    -- meaning a full week has passed since the last advance.
    AND  created_at <= now() - (week_current * INTERVAL '7 days');

  -- Mark plans as completed when all weeks are done
  UPDATE training_plans
  SET    status     = 'completed',
         updated_at = now()
  WHERE  status       = 'active'
    AND  week_current >= weeks_total;
END;
$$;

-- Schedule every Monday at 06:00 UTC (requires pg_cron)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'advance-training-plan-week',
      '0 6 * * 1',  -- Monday 06:00 UTC
      'SELECT advance_training_plan_week()'
    );
  END IF;
END;
$$;
