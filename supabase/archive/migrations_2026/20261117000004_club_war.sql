-- Club war card (mock Groups: "CLUB WAR · ENDS SUNDAY · Striders 58% · Harriers 42%
-- · You added 6,200 m² this week · 4th in the club").
--
-- The war runs Monday to Sunday (UTC). Your club's rival is the club whose
-- members have contested your members' zones most in the last 28 days (either
-- way); with no contests, it is the club just ahead of yours on this week's
-- area (or just behind, if yours leads). Score = area of zones members claimed
-- this week. Only members of the club can read it.

CREATE INDEX IF NOT EXISTS territory_polygons_claimed_owner_idx ON public.territory_polygons (claimed_at, owner_id);

CREATE OR REPLACE FUNCTION public.club_war(p_club_id uuid)
RETURNS TABLE(
  club_name text, rival_id uuid, rival_name text,
  club_area_m2 double precision, rival_area_m2 double precision,
  my_area_m2 double precision, my_rank integer, members_scoring integer,
  ends_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_me    uuid := auth.uid();
  v_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_rival uuid;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = p_club_id AND m.user_id = v_me) THEN
    RETURN;
  END IF;

  -- 1. The club we clash with most.
  SELECT om.club_id INTO v_rival
    FROM run_territory_contests k
    JOIN club_members mm ON mm.club_id = p_club_id
    JOIN club_members om ON om.club_id <> p_club_id
   WHERE k.created_at >= now() - interval '28 days'
     AND ((k.user_id = mm.user_id AND k.rival_owner_id = om.user_id)
       OR (k.rival_owner_id = mm.user_id AND k.user_id = om.user_id))
     AND NOT EXISTS (SELECT 1 FROM club_members x WHERE x.club_id = p_club_id AND x.user_id = om.user_id)
   GROUP BY om.club_id
   ORDER BY count(*) DESC, om.club_id
   LIMIT 1;

  -- 2. Otherwise the club next to us on this week's area.
  IF v_rival IS NULL THEN
    WITH wk AS (
      SELECT m.club_id, sum(t.area_m2) AS area
        FROM territory_polygons t JOIN club_members m ON m.user_id = t.owner_id
       WHERE t.claimed_at >= v_start
       GROUP BY m.club_id
    ), r AS (
      SELECT club_id, row_number() OVER (ORDER BY area DESC, club_id) AS n FROM wk
    )
    SELECT o.club_id INTO v_rival
      FROM r mine JOIN r o ON o.club_id <> mine.club_id
     WHERE mine.club_id = p_club_id
     ORDER BY CASE WHEN o.n = mine.n - 1 THEN 0 WHEN o.n = mine.n + 1 THEN 1 ELSE 2 END, abs(o.n - mine.n)
     LIMIT 1;
  END IF;

  IF v_rival IS NULL THEN RETURN; END IF; -- nobody to fight yet

  RETURN QUERY
  WITH mine AS (
    SELECT t.owner_id, sum(t.area_m2) AS area
      FROM territory_polygons t JOIN club_members m ON m.user_id = t.owner_id AND m.club_id = p_club_id
     WHERE t.claimed_at >= v_start
     GROUP BY t.owner_id
  ), ranked AS (
    SELECT owner_id, area, rank() OVER (ORDER BY area DESC)::int AS rk FROM mine
  )
  SELECT
    (SELECT c.name FROM clubs c WHERE c.id = p_club_id),
    v_rival,
    (SELECT c.name FROM clubs c WHERE c.id = v_rival),
    COALESCE((SELECT sum(area) FROM mine), 0)::double precision,
    COALESCE((SELECT sum(t.area_m2) FROM territory_polygons t JOIN club_members m ON m.user_id = t.owner_id AND m.club_id = v_rival
               WHERE t.claimed_at >= v_start), 0)::double precision,
    COALESCE((SELECT area FROM ranked WHERE owner_id = v_me), 0)::double precision,
    (SELECT rk FROM ranked WHERE owner_id = v_me),
    (SELECT count(*)::int FROM mine),
    v_start + interval '7 days';
END;
$$;
REVOKE ALL ON FUNCTION public.club_war(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_war(uuid) TO authenticated;
