-- Fix: fill_run_calories trigger calls calculate_calories with COALESCE(v_age::smallint, 30)
-- where the literal 30 resolves to integer, causing a type mismatch.
-- Solution: add an overloaded calculate_calories that accepts integer for p_age.

CREATE OR REPLACE FUNCTION public.calculate_calories(
  p_distance_km  numeric,
  p_duration_sec integer,
  p_weight_kg    numeric  DEFAULT 70,
  p_gender       text     DEFAULT 'other',
  p_age          integer  DEFAULT 30
) RETURNS integer
  LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  -- Delegate to the smallint variant
  RETURN public.calculate_calories(
    p_distance_km,
    p_duration_sec,
    p_weight_kg,
    p_gender,
    p_age::smallint
  );
END;
$$;
