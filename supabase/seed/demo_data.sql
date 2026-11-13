-- ════════════════════════════════════════════════════════════════════════════
-- Runivo demo data — fills the app the way the design mock looks.
--
-- Run it in Supabase → SQL Editor (it needs the postgres role). Safe to run
-- again: it clears its own rows first. Remove everything with demo_cleanup.sql.
--
-- What it adds
--   • 8 demo runners (no password — nobody can sign in as them)
--   • their runs, feed posts and zones around two places: the iOS Simulator's
--     default location (San Francisco) and the test account's last known spot
--   • your test account: runs this week, 6 zones (one fading), 1,240 PACE,
--     Chaser rank, awards, notifications, follows both ways, a club with chat
--   • hosted and curated events, PACE Store partners and rewards with codes
--
-- Every row it creates has an id starting with "de3", so cleanup is exact.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ▶ The test account this fills. Change the email to use another account.
CREATE TEMP TABLE demo_cfg ON COMMIT DROP AS SELECT 'runivo.tester1@example.com'::text AS tester_email;

-- Lets the seed write PACE, rank and score columns (see protect_profile_columns).
SELECT set_config('runivo.trusted_writer', 'on', true);

-- Seeded follows and kudos would otherwise send real follow/kudos notifications
-- and pushes. Off for this transaction only (rolled back with it on any error).
ALTER TABLE public.followers       DISABLE TRIGGER trg_notify_follow;
ALTER TABLE public.feed_post_likes DISABLE TRIGGER trg_notify_kudos;
ALTER TABLE public.notifications   DISABLE TRIGGER trg_notify_push;

-- ── helpers ────────────────────────────────────────────────────────────────
-- de3K0000-0000-4000-8000-00000000000N: K = kind (0 users, 1 runs, 2 zones,
-- 3 posts, 4 events, 5 partners, 6 rewards, 7 codes, 8 notifications, 9 awards,
-- a clubs, b messages).
CREATE OR REPLACE FUNCTION pg_temp.did(kind int, n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS
$$ SELECT format('de3%s0000-0000-4000-8000-%s', to_hex(kind), lpad(to_hex(n), 12, '0'))::uuid $$;

-- Offset a point by metres.
CREATE OR REPLACE FUNCTION pg_temp.off_lat(lat float8, dy float8) RETURNS float8 LANGUAGE sql IMMUTABLE AS
$$ SELECT lat + dy / 111320.0 $$;
CREATE OR REPLACE FUNCTION pg_temp.off_lng(lat float8, lng float8, dx float8) RETURNS float8 LANGUAGE sql IMMUTABLE AS
$$ SELECT lng + dx / (111320.0 * cos(radians(lat))) $$;

-- A closed, slightly irregular ring of [lng,lat] pairs (territory_polygons.polygon_coords).
CREATE OR REPLACE FUNCTION pg_temp.ring(lat float8, lng float8, dx float8, dy float8, r float8, seed int)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  WITH c AS (SELECT pg_temp.off_lat(lat, dy) AS clat, pg_temp.off_lng(lat, lng, dx) AS clng),
  pts AS (
    SELECT i, (2 * pi() * i / 9) AS a, r * (0.8 + 0.35 * abs(sin(seed * 1.7 + i * 2.3))) AS rr
      FROM generate_series(0, 8) i
  )
  , arr AS (
    SELECT jsonb_agg(jsonb_build_array(
             round(pg_temp.off_lng(c.clat, c.clng, rr * cos(a))::numeric, 6),
             round(pg_temp.off_lat(c.clat, rr * sin(a))::numeric, 6)) ORDER BY i) AS j
      FROM pts, c
  )
  SELECT j || jsonb_build_array(j->0) FROM arr
$$;

-- A GPS loop of {lat,lng,timestamp} points covering ~km kilometres (runs.gps_points).
CREATE OR REPLACE FUNCTION pg_temp.loop_pts(lat float8, lng float8, dx float8, dy float8, km float8, t0 timestamptz, secs int)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  WITH c AS (SELECT pg_temp.off_lat(lat, dy) AS clat, pg_temp.off_lng(lat, lng, dx) AS clng,
                    km * 1000 / (2 * pi()) AS r)
  SELECT jsonb_agg(jsonb_build_object(
           'lat', round(pg_temp.off_lat(c.clat, c.r * 0.85 * sin(2 * pi() * i / 60))::numeric, 6),
           'lng', round(pg_temp.off_lng(c.clat, c.clng, c.r * 1.15 * cos(2 * pi() * i / 60))::numeric, 6),
           'timestamp', ((extract(epoch FROM t0) + secs * i / 60.0) * 1000)::bigint) ORDER BY i)
    FROM generate_series(0, 60) i, c
$$;

CREATE OR REPLACE FUNCTION pg_temp.tier(m2 float8) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN m2 < 5000 THEN 'patch' WHEN m2 < 50000 THEN 'block' WHEN m2 < 200000 THEN 'district'
              WHEN m2 < 500000 THEN 'quarter' ELSE 'domain' END $$;

CREATE OR REPLACE FUNCTION pg_temp.pace_txt(secs int, km float8) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format('%s:%s', floor(secs / km / 60)::int, lpad((round(secs / km)::int % 60)::text, 2, '0')) $$;

-- ── clear an earlier run of this script ────────────────────────────────────
DELETE FROM public.feed_post_likes  WHERE post_id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.feed_posts       WHERE id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.territory_polygons WHERE id::text LIKE 'de3%' OR owner_id::text LIKE 'de3%';
DELETE FROM public.runs             WHERE id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.followers        WHERE follower_id::text LIKE 'de3%' OR following_id::text LIKE 'de3%';
DELETE FROM public.event_participants WHERE event_id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.events           WHERE id::text LIKE 'de3%';
DELETE FROM public.club_messages    WHERE id::text LIKE 'de3%' OR club_id::text LIKE 'de3%';
DELETE FROM public.club_activity    WHERE club_id::text LIKE 'de3%';
DELETE FROM public.lobby_messages   WHERE user_id::text LIKE 'de3%';
-- Clubs first: deleting a club cascades to its members (the last-owner guard allows that).
DELETE FROM public.clubs            WHERE id::text LIKE 'de3%';
DELETE FROM public.club_members     WHERE club_id::text LIKE 'de3%' OR user_id::text LIKE 'de3%';
DELETE FROM public.pace_redemptions WHERE reward_id::text LIKE 'de3%';
DELETE FROM public.reward_codes     WHERE reward_id::text LIKE 'de3%';
DELETE FROM public.pace_store_rewards WHERE id::text LIKE 'de3%';
DELETE FROM public.partners         WHERE id::text LIKE 'de3%';
DELETE FROM public.notifications    WHERE id::text LIKE 'de3%';
DELETE FROM public.user_awards      WHERE id::text LIKE 'de3%';
DELETE FROM public.profiles         WHERE id::text LIKE 'de3%';
DELETE FROM auth.users              WHERE id::text LIKE 'de3%';

-- ── build ──────────────────────────────────────────────────────────────────
CREATE TEMP TABLE demo_ctx ON COMMIT DROP AS
SELECT u.id AS tester, p.username AS tester_name,
       COALESCE(ST_Y(p.last_known_location::geometry), 12.9763) AS home_lat,
       COALESCE(ST_X(p.last_known_location::geometry), 77.5929) AS home_lng
  FROM auth.users u JOIN public.profiles p ON p.id = u.id
 WHERE lower(u.email) = (SELECT lower(tester_email) FROM demo_cfg);

DO $$
DECLARE
  ctx      record;
  tester   uuid;
  centers  float8[][] ;
  c        int;
  clat     float8;
  clng     float8;
  i        int;
  k        int;
  n_run    int := 0;
  n_zone   int := 0;
  n_post   int := 0;
  uid      uuid;
  uname    text;
  t0       timestamptz;
  km       float8;
  secs     int;
  pts      jsonb;
  ring     jsonb;
  area     float8;
  runner   record;
BEGIN
  SELECT * INTO ctx FROM demo_ctx;
  IF ctx.tester IS NULL THEN
    RAISE EXCEPTION 'No account with that email. Edit tester_email at the top of the script.';
  END IF;
  tester := ctx.tester;

  -- Simulator default (San Francisco, Union Square) and the tester's last known spot.
  centers := ARRAY[[37.7858, -122.4064], [ctx.home_lat, ctx.home_lng]];

  -- ── demo runners ──
  CREATE TEMP TABLE demo_runners (n int, username text, display text, rank text, pace_total int, pace_bal int,
                                  weekly int, bio text, loc text) ON COMMIT DROP;
  INSERT INTO demo_runners VALUES
    (1, 'ana_runs',    'Ana Ruiz',      'sovereign', 4300, 2100, 96, 'Sunrise loops before work. Hyde Park Hustlers.', 'London'),
    (2, 'kofi.k',      'Kofi Mensah',   'hunter',    2400,  880, 88, 'If it''s fading, it''s mine.',                   'London'),
    (3, 'priya_p',     'Priya Patel',   'hunter',    1620,  540, 71, 'Half marathon in March. Trail on weekends.',     'London'),
    (4, 'leo.strides', 'Leo Strides',   'chaser',     980,  310, 64, 'Tempo Tuesdays.',                                 'London'),
    (5, 'maya_m',      'Maya M',        'chaser',     720,  260, 52, 'Slow and steady takes the park.',                 'London'),
    (6, 'jonas',       'Jonas',         'strider',    430,  120, 40, 'Night runner.',                                   'London'),
    (7, 'sara.trail',  'Sara',          'pacer',      160,   60, 22, 'New here. Say hi!',                               'London'),
    (8, 'dev_runs',    'Dev',           'strider',    310,   90, 35, 'Commute runner.',                                 'London');

  FOR runner IN SELECT * FROM demo_runners ORDER BY n LOOP
    uid := pg_temp.did(0, runner.n);
    INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
            format('demo+%s@runivo.test', runner.n), jsonb_build_object('username', runner.username),
            now() - interval '60 days', now());
    UPDATE public.profiles SET
      username = runner.username, display_name = runner.display, bio = runner.bio, location = runner.loc,
      runner_rank = runner.rank, pace_total_earned = runner.pace_total, pace_balance = runner.pace_bal,
      pace_weekly_earned = runner.weekly, pace_weekly_reset_at = date_trunc('week', now()),
      onboarding_completed_at = now() - interval '59 days', profile_visibility = 'public',
      live_run_sharing_enabled = true, country = (SELECT country FROM public.profiles WHERE id = tester)
    WHERE id = uid;
  END LOOP;

  -- ── runs, posts and zones, around both places ──
  FOR c IN 1..2 LOOP
    clat := centers[c][1]; clng := centers[c][2];
    FOR runner IN SELECT * FROM demo_runners ORDER BY n LOOP
      uid := pg_temp.did(0, runner.n);
      -- Two runs each, this week, at different times of day.
      FOR k IN 1..2 LOOP
        n_run := n_run + 1;
        km := 4.5 + ((runner.n * 3 + k * 5) % 7);
        secs := (km * (300 + runner.n * 9 + k * 7))::int;
        t0 := date_trunc('day', now()) - make_interval(days => (runner.n + k * 2 + c) % 6)
              + make_interval(hours => 6 + (runner.n + k) % 3, mins => (runner.n * 7) % 50);
        IF t0 > now() - interval '2 hours' THEN t0 := now() - interval '1 day' - make_interval(hours => runner.n); END IF;
        pts := pg_temp.loop_pts(clat, clng, (runner.n - 4.5) * 380 + k * 120, ((runner.n % 3) - 1) * 520 - k * 90, km, t0, secs);
        INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points, territories_claimed)
        VALUES (pg_temp.did(1, n_run), uid, 'run', t0, t0 + make_interval(secs => secs), km * 1000, secs,
                pg_temp.pace_txt(secs, km), pts, ARRAY[]::text[]);

        -- Zone from this run.
        n_zone := n_zone + 1;
        ring := pg_temp.ring(clat, clng, (runner.n - 4.5) * 380 + k * 160, ((runner.n % 3) - 1) * 520 + k * 140,
                             120 + (9 - runner.n) * 28, n_zone);
        INSERT INTO public.territory_polygons (id, run_id, owner_id, owner_name, polygon_coords, area_m2, freshness,
                                               last_defended_at, claimed_at, tier, is_loop_fill)
        VALUES (pg_temp.did(2, n_zone), pg_temp.did(1, n_run), uid, runner.username, ring, 0,
                CASE WHEN (runner.n + k) % 5 = 0 THEN 32 ELSE 70 + (runner.n * 3) % 30 END,
                t0 + make_interval(secs => secs), t0 + make_interval(secs => secs), 'patch', true);
        UPDATE public.territory_polygons SET area_m2 = ST_Area(geom::geography), tier = pg_temp.tier(ST_Area(geom::geography))
          WHERE id = pg_temp.did(2, n_zone) RETURNING area_m2 INTO area;

        n_post := n_post + 1;
        INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, duration_sec, avg_pace, activity_type, route_points,
                                       territories_claimed, likes, comment_count, created_at, pace_earned, territory_tier,
                                       territory_area_m2, runner_rank, post_type)
        VALUES (pg_temp.did(3, n_post), uid, pg_temp.did(1, n_run), km, secs, pg_temp.pace_txt(secs, km), 'run',
                (SELECT jsonb_agg(jsonb_build_object('lat', p->'lat', 'lng', p->'lng')) FROM jsonb_array_elements(pts) p),
                1, 3 + (runner.n * 7 + k * 5) % 29, (runner.n + k) % 9, t0 + make_interval(secs => secs),
                floor(km)::int + 5, pg_temp.tier(area), area, runner.rank, 'run');
      END LOOP;
    END LOOP;

    -- ── the test account: 3 runs and 3 zones per place (6 total, one fading) ──
    FOR k IN 1..3 LOOP
      n_run := n_run + 1;
      km := CASE k WHEN 1 THEN 8.1 WHEN 2 THEN 5.2 ELSE 3.3 END;
      secs := (km * 332)::int;
      t0 := date_trunc('week', now()) + make_interval(days => LEAST(k - 1, GREATEST(0, extract(isodow FROM now())::int - 2)),
                                                       hours => 6 + c, mins => 40 + k);
      IF t0 > now() - interval '2 hours' THEN t0 := now() - make_interval(days => k, hours => c); END IF;
      pts := pg_temp.loop_pts(clat, clng, -260 + k * 220, 180 - k * 160, km, t0, secs);
      INSERT INTO public.runs (id, user_id, activity_type, started_at, finished_at, distance_m, duration_sec, avg_pace, gps_points, territories_claimed)
      VALUES (pg_temp.did(1, n_run), tester, 'run', t0, t0 + make_interval(secs => secs), km * 1000, secs,
              pg_temp.pace_txt(secs, km), pts, ARRAY[pg_temp.did(2, n_zone + 1)::text]);

      n_zone := n_zone + 1;
      ring := pg_temp.ring(clat, clng, -220 + k * 230, 160 - k * 150, 150 + k * 25, n_zone);
      INSERT INTO public.territory_polygons (id, run_id, owner_id, owner_name, polygon_coords, area_m2, freshness,
                                             last_defended_at, claimed_at, tier, is_loop_fill)
      VALUES (pg_temp.did(2, n_zone), pg_temp.did(1, n_run), tester, ctx.tester_name, ring, 0,
              CASE WHEN k = 3 AND c = 1 THEN 34 ELSE 92 - k * 6 END,
              CASE WHEN k = 3 AND c = 1 THEN now() - interval '6 days' ELSE t0 + make_interval(secs => secs) END,
              now() - make_interval(days => 20 + k), 'patch', true);
      UPDATE public.territory_polygons SET area_m2 = ST_Area(geom::geography), tier = pg_temp.tier(ST_Area(geom::geography))
        WHERE id = pg_temp.did(2, n_zone) RETURNING area_m2 INTO area;

      n_post := n_post + 1;
      INSERT INTO public.feed_posts (id, user_id, run_id, distance_km, duration_sec, avg_pace, activity_type, route_points,
                                     territories_claimed, likes, comment_count, created_at, pace_earned, territory_tier,
                                     territory_area_m2, runner_rank, post_type)
      VALUES (pg_temp.did(3, n_post), tester, pg_temp.did(1, n_run), km, secs, pg_temp.pace_txt(secs, km), 'run',
              (SELECT jsonb_agg(jsonb_build_object('lat', p->'lat', 'lng', p->'lng')) FROM jsonb_array_elements(pts) p),
              1, 0, 0, t0 + make_interval(secs => secs), floor(km)::int + 5, pg_temp.tier(area), area, 'chaser', 'run');
    END LOOP;

    -- kofi.k stole a slice of the tester's first zone here.
    n_post := n_post + 1;
    INSERT INTO public.feed_posts (id, user_id, distance_km, duration_sec, created_at, post_type, stolen_from_username,
                                   stolen_from_user_id, stolen_area_m2, zone_tier, runner_rank, route_points, likes, comment_count)
    VALUES (pg_temp.did(3, n_post), pg_temp.did(0, 2), 6.4, 2050, now() - make_interval(hours => 2 + c * 3), 'conquest',
            ctx.tester_name, tester, 40000, 'district', 'hunter',
            (SELECT jsonb_agg(jsonb_build_object('lat', p->1, 'lng', p->0)) FROM jsonb_array_elements(pg_temp.ring(clat, clng, 0, 0, 240, 7)) p),
            12, 4);
  END LOOP;

  -- Milestone: priya_p reached Hunter.
  n_post := n_post + 1;
  INSERT INTO public.feed_posts (id, user_id, created_at, post_type, runner_rank, likes)
  VALUES (pg_temp.did(3, n_post), pg_temp.did(0, 3), now() - interval '1 day', 'milestone', 'hunter', 9);

  -- ── the test account's profile ──
  UPDATE public.profiles SET
    pace_balance = 1240, pace_total_earned = 1340, pace_weekly_earned = 62,
    pace_weekly_reset_at = date_trunc('week', now()), runner_rank = 'chaser',
    weekly_goal_km = 25, location = COALESCE(location, 'London'),
    -- Store redemptions need an account older than 14 days (reward_block_reason);
    -- back-date this test account so redeeming can be tried.
    created_at = LEAST(created_at, now() - interval '30 days'),
    bio = COALESCE(bio, 'Morning loops and stolen parks.')
  WHERE id = tester;

  -- ── follows: the tester follows six runners; four follow back ──
  INSERT INTO public.followers (follower_id, following_id, created_at)
  SELECT tester, pg_temp.did(0, n), now() - make_interval(days => n) FROM generate_series(1, 6) n
  ON CONFLICT DO NOTHING;
  INSERT INTO public.followers (follower_id, following_id, created_at)
  SELECT pg_temp.did(0, n), tester, now() - make_interval(days => n + 1) FROM generate_series(1, 4) n
  ON CONFLICT DO NOTHING;
  -- Runners follow each other a little, for follower counts.
  INSERT INTO public.followers (follower_id, following_id)
  SELECT pg_temp.did(0, a), pg_temp.did(0, b) FROM generate_series(1, 8) a, generate_series(1, 8) b
   WHERE a <> b AND (a + b) % 3 = 0
  ON CONFLICT DO NOTHING;

  -- Kudos on the tester's runs from followers.
  INSERT INTO public.feed_post_likes (post_id, user_id, created_at)
  SELECT fp.id, pg_temp.did(0, n), fp.created_at + interval '20 minutes'
    FROM public.feed_posts fp, generate_series(1, 4) n
   WHERE fp.user_id = tester AND fp.id::text LIKE 'de3%'
  ON CONFLICT DO NOTHING;
  UPDATE public.feed_posts fp SET likes = (SELECT count(*) FROM public.feed_post_likes l WHERE l.post_id = fp.id)
   WHERE fp.user_id = tester AND fp.id::text LIKE 'de3%';

  -- ── club near the tester, with chat ──
  INSERT INTO public.clubs (id, name, description, badge_emoji, owner_id, join_policy, total_km, created_at)
  VALUES (pg_temp.did(10, 1), 'Hyde Park Hustlers', 'Dawn loops, Saturday long runs, and we defend Kensington.', '⚡',
          pg_temp.did(0, 1), 'open', 3120, now() - interval '90 days'),
         (pg_temp.did(10, 2), 'Thames Path Crew', 'Riverside miles every evening.', '🏃',
          pg_temp.did(0, 4), 'invite_only', 4890, now() - interval '120 days');
  INSERT INTO public.club_members (club_id, user_id, role, joined_at) VALUES
    (pg_temp.did(10, 1), pg_temp.did(0, 1), 'owner', now() - interval '90 days'),
    (pg_temp.did(10, 1), pg_temp.did(0, 2), 'admin', now() - interval '80 days'),
    (pg_temp.did(10, 1), pg_temp.did(0, 3), 'member', now() - interval '60 days'),
    (pg_temp.did(10, 1), pg_temp.did(0, 5), 'member', now() - interval '40 days'),
    (pg_temp.did(10, 1), tester,             'member', now() - interval '20 days'),
    (pg_temp.did(10, 2), pg_temp.did(0, 4), 'owner', now() - interval '120 days'),
    (pg_temp.did(10, 2), pg_temp.did(0, 6), 'member', now() - interval '50 days'),
    (pg_temp.did(10, 2), pg_temp.did(0, 8), 'member', now() - interval '30 days');
  INSERT INTO public.club_messages (id, club_id, user_id, content, created_at) VALUES
    (pg_temp.did(11, 1), pg_temp.did(10, 1), pg_temp.did(0, 1), 'Saturday 8:00 at the Serpentine. 10K loop, easy pace.', now() - interval '5 hours'),
    (pg_temp.did(11, 2), pg_temp.did(10, 1), pg_temp.did(0, 3), 'In. Bringing two friends.', now() - interval '4 hours'),
    (pg_temp.did(11, 3), pg_temp.did(10, 1), pg_temp.did(0, 2), 'Who''s defending Kensington tonight? It''s at 34%.', now() - interval '50 minutes'),
    (pg_temp.did(11, 4), pg_temp.did(10, 1), pg_temp.did(0, 5), 'I can do 7pm.', now() - interval '20 minutes');

  -- Global lobby chatter.
  INSERT INTO public.lobby_messages (lobby_id, user_id, content, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001', pg_temp.did(0, 6), 'Anyone else running in the rain today?', now() - interval '3 hours'),
    ('00000000-0000-0000-0000-000000000001', pg_temp.did(0, 7), 'First zone claimed this morning!', now() - interval '2 hours'),
    ('00000000-0000-0000-0000-000000000001', pg_temp.did(0, 1), 'Nice one Sara. Run it again tomorrow so it stays fresh.', now() - interval '90 minutes');

  -- ── events: three hosted near the tester, two curated races ──
  INSERT INTO public.events (id, title, description, event_type, source, starts_at, ends_at, lat, lng, location_name,
                             distance_m, organizer, club_id, discipline, is_active, pace_bonus, registration_url, source_name)
  VALUES
    (pg_temp.did(4, 1), 'Saturday Park Run', 'Easy 10K loop round the park. All paces welcome; we regroup at every gate.',
     'community-run', 'hosted', date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 10 hours',
     pg_temp.off_lat(ctx.home_lat, 300), pg_temp.off_lng(ctx.home_lat, ctx.home_lng, -200), 'Main park gate',
     10000, 'Hyde Park Hustlers', pg_temp.did(10, 1), 'community_run', true, 10, NULL, NULL),
    (pg_temp.did(4, 2), 'Night Run · Riverside', 'Head torches on. 6K steady along the water.',
     'community-run', 'hosted', date_trunc('day', now()) + interval '1 day 20 hours', date_trunc('day', now()) + interval '1 day 21 hours',
     pg_temp.off_lat(ctx.home_lat, -500), pg_temp.off_lng(ctx.home_lat, ctx.home_lng, 400), 'Riverside steps',
     6000, 'Thames Path Crew', pg_temp.did(10, 2), 'community_run', true, 5, NULL, NULL),
    (pg_temp.did(4, 3), 'Zone Defence Sunday', 'Two hours to refresh every fading zone in the club''s patch.',
     'territory-war', 'hosted', date_trunc('day', now()) + interval '4 days 7 hours', date_trunc('day', now()) + interval '4 days 9 hours',
     pg_temp.off_lat(ctx.home_lat, 100), pg_temp.off_lng(ctx.home_lat, ctx.home_lng, 100), 'Café on the corner',
     8000, 'Hyde Park Hustlers', pg_temp.did(10, 1), 'community_run', true, 15, NULL, NULL),
    (pg_temp.did(4, 4), 'City 10K', 'Closed roads through the centre. Chip timed.',
     'race', 'curated', date_trunc('day', now()) + interval '18 days 7 hours', date_trunc('day', now()) + interval '18 days 11 hours',
     pg_temp.off_lat(ctx.home_lat, 900), pg_temp.off_lng(ctx.home_lat, ctx.home_lng, -700), 'City centre',
     10000, 'City Races', NULL, '10k', true, 0, 'https://example.com/register', 'City Races'),
    (pg_temp.did(4, 5), 'Autumn Half Marathon', 'Flat and fast, two laps of the river.',
     'race', 'curated', date_trunc('day', now()) + interval '32 days 6 hours', date_trunc('day', now()) + interval '32 days 10 hours',
     pg_temp.off_lat(ctx.home_lat, -1200), pg_temp.off_lng(ctx.home_lat, ctx.home_lng, 900), 'Riverside start',
     21100, 'City Races', NULL, 'half_marathon', true, 0, 'https://example.com/register', 'City Races');
  INSERT INTO public.event_participants (event_id, user_id, joined_at)
  SELECT pg_temp.did(4, e), pg_temp.did(0, n), now() - make_interval(hours => n)
    FROM generate_series(1, 3) e, generate_series(1, 8) n WHERE (n + e) % 3 <> 0
  ON CONFLICT DO NOTHING;

  -- ── PACE Store: partners and rewards (global, so they show anywhere) ──
  INSERT INTO public.partners (id, name, category, status, billing_model, website, offer) VALUES
    (pg_temp.did(5, 1), 'Brooks Running', 'shoes',     'active', 'free_listing', 'https://example.com', '20% off'),
    (pg_temp.did(5, 2), 'Stride Lab',     'physio',    'active', 'free_listing', 'https://example.com', 'Gait analysis'),
    (pg_temp.did(5, 3), 'Fuel Co.',       'nutrition', 'active', 'free_listing', 'https://example.com', 'Energy bars'),
    (pg_temp.did(5, 4), 'City Races',     'races',     'active', 'free_listing', 'https://example.com', 'Race entry'),
    (pg_temp.did(5, 5), 'Recover Studio', 'physio',    'active', 'free_listing', 'https://example.com', 'Sports massage');
  INSERT INTO public.pace_store_rewards (id, partner_id, brand, title, description, value_label, pace_cost, tier, brand_color,
                                         brand_initial, category, status, sort_order, code_mode, min_rank, plus_only, how_to_use)
  VALUES
    (pg_temp.did(6, 1), pg_temp.did(5, 1), 'Brooks Running', 'Free running socks', 'A pair of Brooks run socks with any order. One per runner.',
     'Free socks', 40, 'entry', '#0084D6', 'B', 'gear', 'available', 1, 'pool', NULL, false, 'Enter the code at checkout on the Brooks site.'),
    (pg_temp.did(6, 2), pg_temp.did(5, 2), 'Stride Lab', 'Free gait analysis', 'A 30-minute gait analysis with a physio, video included.',
     'Free gait analysis', 150, 'mid', '#1D6B4A', 'S', 'gear', 'available', 2, 'pool', NULL, false, 'Show the code when you book.'),
    (pg_temp.did(6, 3), pg_temp.did(5, 3), 'Fuel Co.', 'Box of 12 energy bars', 'Twelve oat and date bars, delivered.',
     'Box of 12 bars', 120, 'entry', '#E8A317', 'F', 'nutrition', 'available', 3, 'pool', NULL, false, 'Use the code at checkout.'),
    (pg_temp.did(6, 4), pg_temp.did(5, 4), 'City Races', '£10 off a city 10K', '£10 off entry to any City Races 10K this season.',
     '£10 off a 10K', 300, 'mid', '#5B47C9', 'C', 'events', 'available', 4, 'pool', NULL, false, 'Enter the code on the entry form.'),
    (pg_temp.did(6, 5), pg_temp.did(5, 5), 'Recover Studio', 'Sports massage, 30 min', 'A 30-minute sports massage at any studio.',
     'Sports massage', 1500, 'premium', '#0C0C0D', 'R', 'gear', 'available', 5, 'pool', 'hunter', false, 'Book online and quote the code.'),
    (pg_temp.did(6, 6), pg_temp.did(5, 3), 'Fuel Co.', 'Electrolyte tabs', 'A tube of 20 electrolyte tabs. Runivo Plus members only.',
     'Electrolyte tabs', 60, 'entry', '#B0306A', 'F', 'nutrition', 'available', 6, 'pool', NULL, true, 'Use the code at checkout.');
  INSERT INTO public.reward_codes (id, reward_id, code)
  SELECT pg_temp.did(7, r * 100 + n), pg_temp.did(6, r),
         format('RNV-%s-%s', upper(substr(md5(r::text || n::text), 1, 4)), upper(substr(md5(n::text || r::text), 1, 2)))
    FROM generate_series(1, 6) r, generate_series(1, 25) n;

  -- ── notifications and awards for the tester ──
  INSERT INTO public.notifications (id, user_id, type, title, body, read, action_url, created_at) VALUES
    (pg_temp.did(8, 1), tester, 'territory_lost',   'Zone stolen',              'kofi.k took 0.04 km² of your zone · run it to take it back', false, '/territory', now() - interval '2 hours'),
    (pg_temp.did(8, 2), tester, 'kudos',            'ana_runs gave you kudos',  'On your 8.1 km morning loop', false, NULL, now() - interval '3 hours'),
    (pg_temp.did(8, 3), tester, 'mission_complete', 'Mission complete',         'Morning Miles · PACE added', true, '/missions', now() - interval '1 day'),
    (pg_temp.did(8, 4), tester, 'follow',           'priya_p started following you', 'Follow back to see each other live', true, NULL, now() - interval '1 day 2 hours'),
    (pg_temp.did(8, 5), tester, 'event_reminder',   'Saturday Park Run is coming up', '8:00 · Main park gate · 6 going', true, '/events', now() - interval '2 days'),
    (pg_temp.did(8, 6), tester, 'rank_up',          'You reached Chaser',       '600 PACE lifetime', true, NULL, now() - interval '14 days');
  INSERT INTO public.user_awards (id, user_id, award_id, unlocked_at)
  SELECT pg_temp.did(9, t.ord::int), tester, t.a, now() - make_interval(days => 30 - t.ord::int * 4)
    FROM unnest(ARRAY['early_bird', 'first_claim', 'first_5k', 'first_10k', 'streak_7', 'first_blood']) WITH ORDINALITY AS t(a, ord)
   WHERE NOT EXISTS (SELECT 1 FROM public.user_awards ua WHERE ua.user_id = tester AND ua.award_id = t.a);

  RAISE NOTICE 'Demo data ready: % runs, % zones, % posts.', n_run, n_zone, n_post;
END $$;

ALTER TABLE public.followers       ENABLE TRIGGER trg_notify_follow;
ALTER TABLE public.feed_post_likes ENABLE TRIGGER trg_notify_kudos;
ALTER TABLE public.notifications   ENABLE TRIGGER trg_notify_push;

COMMIT;
