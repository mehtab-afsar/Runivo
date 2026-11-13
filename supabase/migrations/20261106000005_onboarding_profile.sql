-- ============================================================================
-- V1 onboarding: the answers PaceX coaches from, and passwordless sign-up.
--
--   * "Why do you run?" now has four answers (PRD): get fit, train for a
--     race, compete, run with people. primary_goal gains 'race' and 'social'
--     (the old values stay valid for existing runners).
--   * "Your running now": usual_distance_km and an optional recent 5K time
--     (weekly_frequency already exists).
--   * pacex_tone: how PaceX talks to this runner, set from the goal.
--   * age_range instead of an exact age (age keeps the range midpoint for
--     calorie maths).
--   * Health data consent is its own record (timestamp + wording version),
--     separate from accepting the terms, as GDPR and India's DPDP rules
--     require. health_baseline holds the 90-day summary from Apple Health /
--     Health Connect; imported runs never claim zones.
--   * handle_new_user: phone sign-ups have no email, so the username fell
--     back to NULL and the insert failed ("Database error saving new user").
--     They now get 'runner' plus a suffix, and pick a real name in onboarding.
-- ============================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_primary_goal_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_primary_goal_check CHECK (
  primary_goal IN ('get_fit', 'race', 'compete', 'social', 'lose_weight', 'run_faster', 'explore')
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usual_distance_km      numeric(4,1) CHECK (usual_distance_km > 0 AND usual_distance_km <= 100),
  ADD COLUMN IF NOT EXISTS recent_5k_seconds      int          CHECK (recent_5k_seconds BETWEEN 720 AND 5400),
  ADD COLUMN IF NOT EXISTS pacex_tone             text         CHECK (pacex_tone IN ('encouraging', 'structured', 'competitive', 'friendly')),
  ADD COLUMN IF NOT EXISTS age_range              text         CHECK (age_range IN ('under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus')),
  ADD COLUMN IF NOT EXISTS health_consent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS health_consent_version text,
  ADD COLUMN IF NOT EXISTS health_baseline        jsonb;

COMMENT ON COLUMN public.profiles.usual_distance_km IS 'Onboarding: usual run distance. Sets the starting weekly target and PaceX pace zones.';
COMMENT ON COLUMN public.profiles.recent_5k_seconds IS 'Onboarding (optional): recent 5K time in seconds. PaceX pace zones.';
COMMENT ON COLUMN public.profiles.pacex_tone        IS 'How PaceX talks to the runner, from their running goal.';
COMMENT ON COLUMN public.profiles.age_range         IS 'Onboarding (optional): age range. Calories and heart-rate zones only.';
COMMENT ON COLUMN public.profiles.health_consent_at IS 'When the runner agreed to share health-app data. NULL = no consent. Separate from terms acceptance.';
COMMENT ON COLUMN public.profiles.health_baseline   IS '90-day summary of imported runs {runs,totalKm,avgWeeklyKm,runsPerWeek,longestKm,avgPaceSecPerKm,days}. Never claims zones.';

-- Withdrawing consent clears what was imported; nothing is kept without consent.
CREATE OR REPLACE FUNCTION public.clear_health_on_consent_withdrawal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- No consent, no health data: covers withdrawal and a baseline sent without consent.
  IF NEW.health_consent_at IS NULL THEN
    NEW.health_baseline := NULL;
    NEW.health_consent_version := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_health_consent ON public.profiles;
CREATE TRIGGER trg_profiles_health_consent
  BEFORE INSERT OR UPDATE OF health_consent_at, health_baseline ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.clear_health_on_consent_withdrawal();

-- ── Phone sign-ups ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_username  text;
  final_username text;
  attempt        int := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(COALESCE(new.email, ''), '@', 1), '')
  );
  base_username := substring(regexp_replace(COALESCE(base_username, ''), '[^a-zA-Z0-9_]', '', 'g'), 1, 20);
  IF base_username = '' THEN
    base_username := 'runner';
  END IF;

  final_username := base_username;
  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (new.id, final_username)
      ON CONFLICT (id) DO NOTHING;
      RETURN new;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt > 10 THEN
        final_username := base_username || '_' || substring(replace(new.id::text, '-', ''), 1, 6);
        INSERT INTO public.profiles (id, username)
        VALUES (new.id, final_username)
        ON CONFLICT DO NOTHING;
        RETURN new;
      END IF;
      final_username := base_username || '_' || substring(md5(random()::text), 1, 4);
    END;
  END LOOP;
END;
$$;
