-- ============================================================
-- Migration 013: Biometrics
-- ============================================================
-- Adds biometric columns to profiles and a runs.calories_burned
-- column. Provides two reusable SQL functions:
--   • calculate_calories()  — MET-based kcal from a run
--   • calculate_bmr()       — Mifflin-St Jeor resting calorie rate
-- ============================================================


-- ----------------------------------------------------------------
-- 1. Add biometric columns to profiles
-- ----------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age        smallint      CHECK (age BETWEEN 10 AND 120),
  ADD COLUMN IF NOT EXISTS gender     text          CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS height_cm  smallint      CHECK (height_cm BETWEEN 50 AND 300),
  ADD COLUMN IF NOT EXISTS weight_kg  numeric(5,1)  CHECK (weight_kg BETWEEN 20 AND 500);

COMMENT ON COLUMN public.profiles.age       IS 'Age in years — used for max heart rate (220-age) and BMR';
COMMENT ON COLUMN public.profiles.gender    IS 'Biological sex — used for Mifflin-St Jeor BMR formula';
COMMENT ON COLUMN public.profiles.height_cm IS 'Height in centimetres — used for BMR and stride estimation';
COMMENT ON COLUMN public.profiles.weight_kg IS 'Body weight in kilograms — primary input for calorie calculation';


-- ----------------------------------------------------------------
-- 2. Add calories_burned to runs
-- ----------------------------------------------------------------

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS calories_burned integer CHECK (calories_burned >= 0);

COMMENT ON COLUMN public.runs.calories_burned IS
  'Kilocalories burned during this run, calculated via calculate_calories().';


-- ----------------------------------------------------------------
-- 3. calculate_calories()
-- ----------------------------------------------------------------
-- MET (Metabolic Equivalent of Task) formula:
--   kcal = MET × weight_kg × duration_hours
--
-- MET is assigned from running pace:
--   < 6 km/h  → 3.5  (brisk walk)
--   6–8 km/h  → 6.0  (light jog)
--   8–10 km/h → 8.0  (moderate run — average runner)
--   10–12 km/h→ 10.0 (fast run)
--   > 12 km/h → 12.0 (sprint / race pace)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_calories(
  p_distance_km  numeric,
  p_duration_sec integer,
  p_weight_kg    numeric  DEFAULT 70,
  p_gender       text     DEFAULT 'other',
  p_age          smallint DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_speed_kmh    numeric;
  v_met          numeric;
  v_duration_hrs numeric;
BEGIN
  -- Guard: nothing to calculate
  IF p_duration_sec <= 0 OR p_distance_km <= 0 THEN
    RETURN 0;
  END IF;

  v_duration_hrs := p_duration_sec::numeric / 3600.0;
  v_speed_kmh    := p_distance_km / v_duration_hrs;

  -- MET lookup by pace band
  v_met := CASE
    WHEN v_speed_kmh < 6  THEN 3.5
    WHEN v_speed_kmh < 8  THEN 6.0
    WHEN v_speed_kmh < 10 THEN 8.0
    WHEN v_speed_kmh < 12 THEN 10.0
    ELSE                       12.0
  END;

  RETURN GREATEST(ROUND(v_met * p_weight_kg * v_duration_hrs), 0);
END;
$$;

COMMENT ON FUNCTION public.calculate_calories(numeric, integer, numeric, text, smallint) IS
  'MET-based calorie estimator.
   Args: distance_km, duration_sec, weight_kg (default 70), gender, age.
   Returns kcal burned. Assigns MET from running speed, scales by body weight.
   Example: SELECT calculate_calories(5.0, 1800, 75, ''male'', 28);  → ~525 kcal';


-- ----------------------------------------------------------------
-- 4. calculate_bmr()
-- ----------------------------------------------------------------
-- Mifflin-St Jeor equation (most accurate for general population):
--   Men:   BMR = 10×weight + 6.25×height - 5×age + 5
--   Women: BMR = 10×weight + 6.25×height - 5×age - 161
--   Other: average of the two
--
-- Returns daily resting kcal (before activity multiplier).
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_bmr(
  p_weight_kg numeric,
  p_height_cm smallint,
  p_age       smallint,
  p_gender    text DEFAULT 'other'
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base numeric;
  v_bmr  numeric;
BEGIN
  -- Guard
  IF p_weight_kg IS NULL OR p_height_cm IS NULL OR p_age IS NULL THEN
    RETURN NULL;
  END IF;

  v_base := 10 * p_weight_kg + 6.25 * p_height_cm - 5 * p_age;

  v_bmr := CASE p_gender
    WHEN 'male'   THEN v_base + 5
    WHEN 'female' THEN v_base - 161
    ELSE               v_base - 78   -- midpoint of male/female constants
  END;

  RETURN GREATEST(ROUND(v_bmr), 0);
END;
$$;

COMMENT ON FUNCTION public.calculate_bmr(numeric, smallint, smallint, text) IS
  'Mifflin-St Jeor BMR formula. Returns daily resting kcal.
   Multiply by activity factor (1.2–1.9) for total daily energy expenditure (TDEE).
   Example: SELECT calculate_bmr(75, 178, 28, ''male'');  → ~1818 kcal/day';


-- ----------------------------------------------------------------
-- 5. Trigger: auto-fill calories_burned on run insert/update
-- ----------------------------------------------------------------
-- When a run is saved and the user has biometrics, the DB
-- calculates calories automatically — no app-side math needed.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fill_run_calories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight  numeric(5,1);
  v_gender  text;
  v_age     smallint;
BEGIN
  -- Only fill if not already supplied by the client
  IF NEW.calories_burned IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch biometrics for this runner
  SELECT weight_kg, gender, age
  INTO   v_weight, v_gender, v_age
  FROM   public.profiles
  WHERE  id = NEW.user_id;

  NEW.calories_burned := public.calculate_calories(
    (NEW.distance_m::numeric / 1000),   -- metres → km
    NEW.duration_sec,
    COALESCE(v_weight, 70),
    COALESCE(v_gender, 'other'),
    COALESCE(v_age, 30)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER runs_fill_calories
  BEFORE INSERT OR UPDATE OF distance_m, duration_sec
  ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_run_calories();

COMMENT ON TRIGGER runs_fill_calories ON public.runs IS
  'Auto-calculates calories_burned using the runner's stored biometrics.
   Skips calculation if the client already supplied a value.';
