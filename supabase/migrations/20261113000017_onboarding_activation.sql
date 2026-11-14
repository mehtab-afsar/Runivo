-- O4: which onboarding path a runner took, and the activation number per
-- path: the share of new runners who record a run within 24 hours.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_variant text
  CHECK (onboarding_variant IS NULL OR onboarding_variant IN ('full', 'short'));

-- For the team (service role): sign-ups since a date, by variant.
CREATE OR REPLACE FUNCTION public.onboarding_activation(p_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE (variant text, signed_up int, finished_onboarding int, ran_within_24h int, activation_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT p.id, COALESCE(p.onboarding_variant, 'full') AS variant, p.created_at, p.onboarding_completed_at,
           EXISTS (SELECT 1 FROM runs r WHERE r.user_id = p.id AND r.started_at <= p.created_at + interval '24 hours'
                     AND r.distance_m >= 500) AS ran
      FROM profiles p
     WHERE p.created_at >= p_since AND p.created_at <= now() - interval '24 hours'
  )
  SELECT variant, count(*)::int, count(onboarding_completed_at)::int, count(*) FILTER (WHERE ran)::int,
         round(100.0 * count(*) FILTER (WHERE ran) / NULLIF(count(*), 0), 1)
    FROM c GROUP BY variant ORDER BY variant;
$$;
REVOKE ALL ON FUNCTION public.onboarding_activation(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_activation(timestamptz) TO service_role;
