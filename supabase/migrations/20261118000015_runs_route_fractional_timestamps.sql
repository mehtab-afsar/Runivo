-- Runs: accept GPS fix times with a fractional millisecond.
--
-- iOS reports location timestamps like 1795015014321.3967. derive_run_route()
-- ordered the points by (timestamp)::bigint, which raised 22P02 "invalid input
-- syntax for type bigint" and rejected the whole run upload. The app now rounds
-- times before upload; ordering by numeric keeps the server safe for any older
-- build or recovered run that still sends a fraction.
SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.derive_run_route() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  coords text;
begin
  if new.gps_points is null or jsonb_array_length(new.gps_points) < 2 then
    return new;
  end if;

  select string_agg(
    (p->>'lng') || ' ' || (p->>'lat'),
    ','
    order by (p->>'timestamp')::numeric
  )
  into coords
  from jsonb_array_elements(new.gps_points) as p;

  new.route := st_geomfromtext('LINESTRING(' || coords || ')', 4326);
  return new;
end;
$$;
