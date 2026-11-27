-- ========================================================================
-- Races
-- ========================================================================
-- Race catalogue, runner-added races and race entries.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: race_distances, race_entries, races

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.race_distances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    race_id uuid NOT NULL,
    distance_m integer NOT NULL,
    label text NOT NULL,
    start_time time without time zone,
    CONSTRAINT race_distances_distance_m_check CHECK (((distance_m >= 1000) AND (distance_m <= 100000))),
    CONSTRAINT race_distances_label_check CHECK (((char_length(label) >= 1) AND (char_length(label) <= 20)))
);

CREATE TABLE public.race_entries (
    user_id uuid NOT NULL,
    race_distance_id uuid NOT NULL,
    plan_id uuid,
    goal_sec integer,
    visibility text DEFAULT 'followers'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT race_entries_goal_sec_check CHECK (((goal_sec IS NULL) OR ((goal_sec >= 600) AND (goal_sec <= 36000)))),
    CONSTRAINT race_entries_visibility_check CHECK ((visibility = ANY (ARRAY['everyone'::text, 'followers'::text, 'only_me'::text])))
);

CREATE TABLE public.races (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    city text,
    country text DEFAULT 'IN'::text NOT NULL,
    lat numeric(9,6),
    lng numeric(9,6),
    starts_on date NOT NULL,
    website_url text,
    source text DEFAULT 'runner'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid,
    event_id uuid,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT races_city_check CHECK (((city IS NULL) OR (char_length(city) <= 60))),
    CONSTRAINT races_name_check CHECK (((char_length(btrim(name)) >= 3) AND (char_length(btrim(name)) <= 80))),
    CONSTRAINT races_source_check CHECK ((source = ANY (ARRAY['curated'::text, 'runner'::text]))),
    CONSTRAINT races_status_check CHECK ((status = ANY (ARRAY['approved'::text, 'pending'::text, 'rejected'::text, 'cancelled'::text]))),
    CONSTRAINT races_website_url_check CHECK (((website_url IS NULL) OR (website_url ~ '^https://[^\s]+$'::text)))
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.race_distances
    ADD CONSTRAINT race_distances_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.race_distances
    ADD CONSTRAINT race_distances_race_id_distance_m_key UNIQUE (race_id, distance_m);

ALTER TABLE ONLY public.race_entries
    ADD CONSTRAINT race_entries_pkey PRIMARY KEY (user_id, race_distance_id);

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_event_id_key UNIQUE (event_id);

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.add_runner_race(p_name text, p_starts_on date, p_distance_m integer, p_city text DEFAULT NULL::text, p_url text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_uid uuid := auth.uid();
  v_race uuid;
  v_dist uuid;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_uid is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 80 then return jsonb_build_object('error', 'bad_name'); end if;
  if p_starts_on is null or p_starts_on <= current_date or p_starts_on > current_date + 730 then return jsonb_build_object('error', 'bad_date'); end if;
  if p_distance_m is null or p_distance_m not between 1000 and 100000 then return jsonb_build_object('error', 'bad_distance'); end if;
  if v_url is not null and v_url !~ '^https://[^\s]+$' then return jsonb_build_object('error', 'bad_url'); end if;
  if (select count(*) from races where created_by = v_uid and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('error', 'too_many');
  end if;
  insert into races (name, city, starts_on, website_url, source, status, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_city, '')), ''), p_starts_on, v_url, 'runner', 'pending', v_uid)
  returning id into v_race;
  insert into race_distances (race_id, distance_m, label) values (v_race, p_distance_m, race_distance_label(p_distance_m))
  returning id into v_dist;
  return jsonb_build_object('race_id', v_race, 'distance_id', v_dist);
end;
$_$;

CREATE FUNCTION public.enter_race(p_race_distance_id uuid, p_plan_id uuid DEFAULT NULL::uuid, p_goal_sec integer DEFAULT NULL::integer, p_visibility text DEFAULT 'followers'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return 'not_signed_in'; end if;
  if not exists (
    select 1 from race_distances d join races r on r.id = d.race_id
     where d.id = p_race_distance_id and (r.status = 'approved' or (r.status = 'pending' and r.created_by = v_uid))
  ) then return 'not_found'; end if;
  if p_plan_id is not null and not exists (select 1 from training_plans where id = p_plan_id and user_id = v_uid) then
    return 'not_found';
  end if;
  insert into race_entries (user_id, race_distance_id, plan_id, goal_sec, visibility)
  values (v_uid, p_race_distance_id, p_plan_id, p_goal_sec,
          case when p_visibility in ('everyone', 'followers', 'only_me') then p_visibility else 'followers' end)
  on conflict (user_id, race_distance_id) do update
    set plan_id = coalesce(excluded.plan_id, race_entries.plan_id),
        goal_sec = coalesce(excluded.goal_sec, race_entries.goal_sec),
        visibility = excluded.visibility;
  return 'entered';
end;
$$;

CREATE FUNCTION public.leave_race(p_race_distance_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  delete from race_entries where user_id = auth.uid() and race_distance_id = p_race_distance_id;
$$;

CREATE FUNCTION public.race_distance_label(p_m integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when abs(p_m - 42195) <= 300 then 'Marathon'
    when abs(p_m - 21097) <= 200 then 'Half'
    when p_m % 1000 = 0 then (p_m / 1000)::text || 'K'
    else round(p_m / 1000.0, 1)::text || ' km'
  end;
$$;

CREATE FUNCTION public.review_runner_race(p_race_id uuid, p_approve boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and subscription_tier = 'admin') then return 'not_allowed'; end if;
  update races set status = case when p_approve then 'approved' else 'rejected' end, checked_at = now()
   where id = p_race_id and source = 'runner' and status = 'pending';
  return case when found then 'done' else 'not_found' end;
end;
$$;

CREATE FUNCTION public.search_races(p_q text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_distance_m integer DEFAULT NULL::integer, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_limit integer DEFAULT 30) RETURNS TABLE(race_id uuid, name text, city text, starts_on date, website_url text, source text, status text, distances jsonb, km_away integer, entrants integer, mine boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with base as (
    select r.*,
      case when p_lat is not null and p_lng is not null and r.lat is not null and r.lng is not null
        then round(st_distance(st_makepoint(r.lng, r.lat)::geography, st_makepoint(p_lng, p_lat)::geography) / 1000)::integer end as km
    from races r
    where (r.status = 'approved' or (r.status = 'pending' and r.created_by = auth.uid()))
      and r.starts_on >= greatest(current_date, coalesce(p_from, current_date))
      and (p_to is null or r.starts_on <= p_to)
      and (p_q is null or btrim(p_q) = '' or r.name ilike '%' || btrim(p_q) || '%' or r.city ilike '%' || btrim(p_q) || '%')
      and (p_distance_m is null or exists (select 1 from race_distances d where d.race_id = r.id and abs(d.distance_m - p_distance_m) <= greatest(200, p_distance_m * 0.03)))
  )
  select b.id, b.name, b.city, b.starts_on, b.website_url, b.source, b.status,
    coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'distance_m', d.distance_m, 'label', d.label, 'start_time', to_char(d.start_time, 'HH24:MI')) order by d.distance_m desc)
              from race_distances d where d.race_id = b.id), '[]'::jsonb),
    b.km,
    (select case when count(*) = 0 then 0 when count(*) < 5 then -1 else count(*)::integer end
       from race_entries e join race_distances d on d.id = e.race_distance_id where d.race_id = b.id),
    exists (select 1 from race_entries e join race_distances d on d.id = e.race_distance_id where d.race_id = b.id and e.user_id = auth.uid())
  from base b
  order by (b.km is not null and b.km <= 150) desc, b.starts_on, b.km nulls last, b.name
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

CREATE FUNCTION public.sync_race_for_event(new public.events) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_m integer;
  v_race uuid;
begin
  v_m := coalesce(new.distance_m, case new.discipline
    when 'marathon' then 42195 when 'half_marathon' then 21097 when '10k' then 10000 when '5k' then 5000 end);
  if new.source <> 'curated' or v_m is null or new.discipline not in ('marathon', 'half_marathon', '10k', '5k', 'trail_run', 'community_run') then
    delete from public.races where event_id = new.id;
    return;
  end if;
  insert into public.races (name, city, lat, lng, starts_on, website_url, source, status, event_id, checked_at)
  values (new.title, new.location_name, new.lat, new.lng, (new.starts_at at time zone 'Asia/Kolkata')::date,
          case when new.registration_url ~ '^https://[^\s]+$' then new.registration_url end,
          'curated', case when new.is_active then 'approved' else 'cancelled' end, new.id, now())
  on conflict (event_id) do update set
    name = excluded.name, city = excluded.city, lat = excluded.lat, lng = excluded.lng,
    starts_on = excluded.starts_on, website_url = excluded.website_url, status = excluded.status, checked_at = now()
  returning id into v_race;
  delete from public.race_distances where race_id = v_race and distance_m <> v_m;
  insert into public.race_distances (race_id, distance_m, label, start_time)
  values (v_race, v_m, public.race_distance_label(v_m), (new.starts_at at time zone 'Asia/Kolkata')::time)
  on conflict (race_id, distance_m) do update set start_time = excluded.start_time;
end;
$_$;

CREATE FUNCTION public.sync_race_from_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.sync_race_for_event(new);
  return new;
end;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.race_distances
    ADD CONSTRAINT race_distances_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.race_entries
    ADD CONSTRAINT race_entries_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.race_entries
    ADD CONSTRAINT race_entries_race_distance_id_fkey FOREIGN KEY (race_distance_id) REFERENCES public.race_distances(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.race_entries
    ADD CONSTRAINT race_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX race_entries_distance_idx ON public.race_entries USING btree (race_distance_id);

CREATE INDEX races_created_by_idx ON public.races USING btree (created_by);

CREATE INDEX races_starts_on_idx ON public.races USING btree (starts_on) WHERE (status = 'approved'::text);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER trg_sync_race_from_event AFTER INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.sync_race_from_event();


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.race_distances ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.race_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "race_distances: of a visible race" ON public.race_distances FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.races r
  WHERE ((r.id = race_distances.race_id) AND ((r.status = 'approved'::text) OR (r.created_by = auth.uid()))))));

CREATE POLICY "race_entries: own" ON public.race_entries FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "races: approved or own" ON public.races FOR SELECT TO authenticated USING (((status = 'approved'::text) OR (created_by = auth.uid())));


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.add_runner_race(p_name text, p_starts_on date, p_distance_m integer, p_city text, p_url text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.add_runner_race(p_name text, p_starts_on date, p_distance_m integer, p_city text, p_url text) TO authenticated;
GRANT ALL ON FUNCTION public.add_runner_race(p_name text, p_starts_on date, p_distance_m integer, p_city text, p_url text) TO service_role;

REVOKE ALL ON FUNCTION public.enter_race(p_race_distance_id uuid, p_plan_id uuid, p_goal_sec integer, p_visibility text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.enter_race(p_race_distance_id uuid, p_plan_id uuid, p_goal_sec integer, p_visibility text) TO authenticated;
GRANT ALL ON FUNCTION public.enter_race(p_race_distance_id uuid, p_plan_id uuid, p_goal_sec integer, p_visibility text) TO service_role;

REVOKE ALL ON FUNCTION public.leave_race(p_race_distance_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.leave_race(p_race_distance_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.leave_race(p_race_distance_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.review_runner_race(p_race_id uuid, p_approve boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.review_runner_race(p_race_id uuid, p_approve boolean) TO authenticated;
GRANT ALL ON FUNCTION public.review_runner_race(p_race_id uuid, p_approve boolean) TO service_role;

REVOKE ALL ON FUNCTION public.search_races(p_q text, p_from date, p_to date, p_distance_m integer, p_lat double precision, p_lng double precision, p_limit integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.search_races(p_q text, p_from date, p_to date, p_distance_m integer, p_lat double precision, p_lng double precision, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_races(p_q text, p_from date, p_to date, p_distance_m integer, p_lat double precision, p_lng double precision, p_limit integer) TO service_role;

REVOKE ALL ON FUNCTION public.sync_race_for_event(new public.events) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.sync_race_for_event(new public.events) TO service_role;

REVOKE ALL ON FUNCTION public.sync_race_from_event() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.sync_race_from_event() TO service_role;


-- ── Starting data ──────────────────────────────────────────────────────

do $$
declare
  r record;
  v_race uuid;
  d integer;
begin
  for r in
    select * from (values
      ('Adani Ahmedabad Marathon',        'Ahmedabad', 23.0225, 72.5714, date '2026-11-29', 'https://www.ahmedabadmarathon.com',        array[42195, 21097, 10000, 5000]),
      ('JBG Kolkata Marathon',            'Kolkata',   22.5726, 88.3639, date '2026-11-29', 'https://www.jbgkolkatamarathon.com',       array[42195, 21097, 10000, 5000]),
      ('Vedanta Pink City Half Marathon', 'Jaipur',    26.9124, 75.7873, date '2026-11-29', 'https://pinkcitymarathon.com',             array[21097, 10000, 5000]),
      ('Bharat Midnight Marathon',        'Bengaluru', 12.9850, 77.7280, date '2026-12-05', 'https://midnightmarathon.in',              array[42195, 31600, 21097, 10000, 5000]),
      ('Pune International Marathon',     'Pune',      18.5204, 73.8567, date '2026-12-06', 'https://www.marathonpune.com',             array[42195, 21097, 10000, 5000]),
      ('SKF Goa River Marathon',          'Goa',       15.4000, 73.8400, date '2026-12-13', 'https://www.skfgoarivermarathon.com',      array[42195, 32186, 21097, 10000, 5000]),
      ('Tata Steel World 25K Kolkata',    'Kolkata',   22.5726, 88.3639, date '2026-12-20', 'https://tatasteelworld25k.procam.in',      array[25000, 10000]),
      ('Freshworks Chennai Marathon',     'Chennai',   13.0827, 80.2707, date '2027-01-03', 'https://www.thechennaimarathon.com',       array[42195, 32186, 21097, 10000]),
      ('Tata Mumbai Marathon',            'Mumbai',    19.0760, 72.8777, date '2027-01-17', 'https://tatamumbaimarathon.procam.in',     array[42195, 21097, 10000]),
      ('MG Vadodara International Marathon', 'Vadodara', 22.3072, 73.1812, date '2027-02-07', 'https://www.vadodaramarathon.com',      array[42195, 21097, 10000, 5000]),
      ('AU Jaipur Marathon',              'Jaipur',    26.9124, 75.7873, date '2027-02-14', 'https://www.marathonjaipur.com',           array[42195, 21097, 10000, 5000]),
      ('IEM-UEM Kolkata Marathon',        'Kolkata',   22.5726, 88.3639, date '2027-02-21', 'https://iemuemkolkatamarathon.org',        array[42195, 21097]),
      ('Cognizant New Delhi Marathon',    'New Delhi', 28.6139, 77.2090, date '2027-02-28', 'https://www.newdelhimarathon.com',         array[42195, 21097, 10000, 5000]),
      ('TCS World 10K Bengaluru',         'Bengaluru', 12.9716, 77.5946, date '2027-04-25', 'https://tcsworld10k.procam.in',            array[10000]),
      ('NMDC Hyderabad Marathon',         'Hyderabad', 17.3850, 78.4867, date '2027-08-28', 'https://nmdchyderabadmarathon.com',        array[42195]),
      ('Mumbai Half Marathon',            'Mumbai',    19.0760, 72.8777, date '2027-08-29', 'https://www.mumbaihalfmarathon.com',       array[21097]),
      ('Vedanta Zinc City Half Marathon', 'Udaipur',   24.5854, 73.7125, date '2027-09-05', 'https://vedantazchm.abcr.in',              array[21097]),
      ('Sekhon Indian Air Force Marathon', 'New Delhi', 28.6139, 77.2090, date '2027-10-03', 'https://sekhoniafmarathon.in',            array[42195])
    ) as t(name, city, lat, lng, starts_on, url, distances)
  loop
    if exists (select 1 from public.races where name = r.name and starts_on = r.starts_on) then continue; end if;
    insert into public.races (name, city, lat, lng, starts_on, website_url, source, status, checked_at)
    values (r.name, r.city, r.lat, r.lng, r.starts_on, r.url, 'curated', 'approved', now())
    returning id into v_race;
    foreach d in array r.distances loop
      insert into public.race_distances (race_id, distance_m, label) values (v_race, d, public.race_distance_label(d));
    end loop;
  end loop;
end $$;
