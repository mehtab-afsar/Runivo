-- ============================================================
-- Security hardening batch (audit findings M3, M2, M1, H3).
-- Each section is independent and idempotent.
-- ============================================================

-- ── M3. handle_referral: any signed-in user could call it with any ids ───────
-- SECURITY DEFINER, no auth.uid() check, no search_path, granted to
-- `authenticated`: it let a caller force any victim to follow them and mint
-- +50 coins per call, repeatably. Nothing in the app, the web, or the edge
-- functions calls it, so it is removed rather than patched.
DROP FUNCTION IF EXISTS public.handle_referral(uuid, text);

-- ── M2. Events: client-writable "curated" rows with arbitrary links ──────────
-- With subscriptions off, effective_tier() is 'premium' for everyone, and the
-- older "events: premium only" INSERT policy has no `source` check. Permissive
-- policies are OR-ed, so it overrode the stricter "premium can create" policy
-- (hosted only, unless admin) and let anyone insert `curated` events shown to
-- every user. Keep the strict one.
DROP POLICY IF EXISTS "events: premium only" ON public.events;

-- A registration link is opened in the browser from the events list. Only http(s)
-- is acceptable (no javascript:, intent:, file: or app-scheme links). NOT VALID:
-- checks every new or changed row without failing on rows that already exist.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_registration_url_https;
ALTER TABLE public.events ADD CONSTRAINT events_registration_url_https
  CHECK (registration_url IS NULL OR registration_url ~* '^https?://[^[:space:]]+$') NOT VALID;

-- ── M1. device_connections.provider_user_id is client-writable ───────────────
-- device-webhook routes a Garmin activity to whichever connection has a matching
-- metadata.provider_user_id. Clients may write `metadata` (apple_health keeps
-- sync stats there), so a user could claim another runner's provider id and
-- receive their activities, or make the match ambiguous so the victim's imports
-- are dropped. Only the service role (the webhook, which learns the id from the
-- provider) may set it; for clients the value is kept as-is on UPDATE and
-- stripped on INSERT.
CREATE OR REPLACE FUNCTION public.protect_device_provider_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;                                   -- service role / migrations
  END IF;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) - 'provider_user_id';
  IF TG_OP = 'UPDATE' AND OLD.metadata ? 'provider_user_id' THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('provider_user_id', OLD.metadata -> 'provider_user_id');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_device_provider_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_device_provider_id ON public.device_connections;
CREATE TRIGGER trg_protect_device_provider_id
  BEFORE INSERT OR UPDATE OF metadata ON public.device_connections
  FOR EACH ROW EXECUTE FUNCTION public.protect_device_provider_id();

-- ── H3. Territory visibility did not hold for direct table reads ─────────────
-- tp_read hid zones of owners with `hide_zones_from_map` by querying `profiles`
-- inside the policy, but `profiles` is owner-readable only, so for anyone else
-- that subquery sees no row and the zone stayed visible. It also had no TO
-- clause, so `anon` could read every zone and its owner_id. Use the
-- SECURITY DEFINER helper that already encodes the rule, and require sign-in.
DROP POLICY IF EXISTS "tp_read" ON public.territory_polygons;
CREATE POLICY "tp_read" ON public.territory_polygons FOR SELECT TO authenticated
  USING (public.zone_visible_to(auth.uid(), owner_id, near_private_place));

-- get_city_rank was a location oracle: SECURITY DEFINER, any caller, any
-- p_user_id / centre / radius, counting rivals by profiles.last_known_location
-- (a column deliberately hidden from clients). Probing with a tiny radius at
-- many centres pinpoints where each runner lives. Now: you can only ask about
-- yourself, and the radius is clamped to 5-50 km so one answer can't localise
-- anyone. (Residual: repeated queries at coarse radii still leak a coarse
-- area; acceptable for a rank widget, and tighter than before.)
CREATE OR REPLACE FUNCTION public.get_city_rank(
  p_user_id   uuid,
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision DEFAULT 10
)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_radius_km double precision := LEAST(GREATEST(COALESCE(p_radius_km, 10), 5), 50);
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COUNT(*)::integer + 1
    FROM (
      SELECT t.owner_id, SUM(t.area_m2) AS total_area
      FROM territory_polygons t
      JOIN profiles p ON p.id = t.owner_id
      WHERE t.owner_id <> p_user_id
        AND p.last_known_location IS NOT NULL
        AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
              p.last_known_location::geography,
              v_radius_km * 1000
            )
      GROUP BY t.owner_id
    ) rivals
    WHERE rivals.total_area > (
      SELECT COALESCE(SUM(area_m2), 0) FROM territory_polygons WHERE owner_id = p_user_id
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_city_rank(uuid, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_city_rank(uuid, double precision, double precision, double precision) TO authenticated;
