-- ════════════════════════════════════════════════════════════════════════════
-- Runivo demo data, part 2 — fills the screens added after demo_data.sql.
--
-- Run demo_data.sql first, then this, in Supabase → SQL Editor. Safe to run
-- again. demo_cleanup.sql removes both.
--
-- What it adds
--   • a home area for the test account (if it has none) and for the 8 demo
--     runners, 1 to 9 km away: Runners near you, the local leaderboard
--   • this week's PACE for everyone: the weekly PACE leaderboard
--   • two live sponsored challenges (joined one) and two group challenges
--     (one you started, one you're invited to): Challenges
--   • pace groups, arrivals and your bookmark on the hosted events
--   • a redeemed reward with its code: Store → My rewards
--   • two saved public routes near you: Routes near you
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;
CREATE TEMP TABLE demo_cfg ON COMMIT DROP AS SELECT 'runivo.tester1@example.com'::text AS tester_email;
SELECT set_config('runivo.trusted_writer', 'on', true);
ALTER TABLE public.notifications DISABLE TRIGGER trg_notify_push;

CREATE OR REPLACE FUNCTION pg_temp.did(kind int, n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS
$$ SELECT format('de3%s0000-0000-4000-8000-%s', to_hex(kind), lpad(to_hex(n), 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION pg_temp.pt(lat float8, lng float8, dy float8, dx float8) RETURNS geography LANGUAGE sql IMMUTABLE AS
$$ SELECT ST_SetSRID(ST_MakePoint(lng + dx / (111320 * cos(radians(lat))), lat + dy / 111320), 4326)::geography $$;

-- Ids: c sponsored challenges, d group challenges, e redemptions, f routes.
DELETE FROM public.sponsored_challenge_entries WHERE challenge_id::text LIKE 'de3c%';
DELETE FROM public.sponsored_challenges        WHERE id::text LIKE 'de3c%';
DELETE FROM public.group_challenge_members     WHERE challenge_id::text LIKE 'de3d%';
DELETE FROM public.group_challenges            WHERE id::text LIKE 'de3d%';
DELETE FROM public.pace_redemptions            WHERE id::text LIKE 'de3e%';
UPDATE public.reward_codes SET assigned_to = NULL, assigned_at = NULL WHERE reward_id::text LIKE 'de3%' AND code LIKE 'RNV-DEMO%';
DELETE FROM public.reward_codes                WHERE code LIKE 'RNV-DEMO%';
DELETE FROM public.saved_routes                WHERE id::text LIKE 'de3f%';
DELETE FROM public.event_bookmarks             WHERE event_id::text LIKE 'de3%';
DELETE FROM public.pace_awards                 WHERE source = 'adjustment' AND source_key LIKE 'demo:%';

DO $$
DECLARE
  tester uuid;
  hlat float8;
  hlng float8;
  n int;
BEGIN
  SELECT u.id INTO tester FROM auth.users u WHERE lower(u.email) = (SELECT lower(tester_email) FROM demo_cfg);
  IF tester IS NULL THEN RAISE EXCEPTION 'No account with that email. Edit tester_email at the top of the script.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = pg_temp.did(0, 1)) THEN
    RAISE EXCEPTION 'Run demo_data.sql first.';
  END IF;

  -- ── home areas ──
  UPDATE public.profiles SET last_known_location = ST_SetSRID(ST_MakePoint(77.5929, 12.9763), 4326)
   WHERE id = tester AND last_known_location IS NULL;
  SELECT ST_Y(last_known_location::geometry), ST_X(last_known_location::geometry) INTO hlat, hlng FROM public.profiles WHERE id = tester;
  FOR n IN 1..8 LOOP
    UPDATE public.profiles
       SET last_known_location = pg_temp.pt(hlat, hlng, (n * 1100) * sin(n), (n * 1100) * cos(n))::geometry,
           country = COALESCE(country, (SELECT country FROM public.profiles WHERE id = tester))
     WHERE id = pg_temp.did(0, n);
  END LOOP;

  -- ── this week's PACE: the weekly board reads the PACE ledger ──
  INSERT INTO public.pace_awards (user_id, source, source_key, requested, credited, created_at)
  SELECT p.id, 'adjustment', 'demo:' || p.id || ':' || to_char(now(), 'IYYY-IW'), p.pace_weekly_earned, p.pace_weekly_earned,
         greatest(date_trunc('week', now()), now() - interval '1 day')
    FROM public.profiles p
   WHERE (p.id::text LIKE 'de30%' OR p.id = tester) AND COALESCE(p.pace_weekly_earned, 0) > 0
  ON CONFLICT (source, source_key) DO NOTHING;

  -- Sponsored challenges are not seeded: prize contests need official rules and
  -- an "Apple is not a sponsor" notice (App Store 5.3) before they go to review.


  -- ── group challenges: one you started, one you're invited to ──
  INSERT INTO public.group_challenges (id, creator_id, title, metric, target, starts_at, ends_at)
  VALUES (pg_temp.did(13, 1), tester, 'November 100 km', 'distance_km', 100, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'),
         (pg_temp.did(13, 2), pg_temp.did(0, 2), 'Claim 10 zones', 'zones', 10, now() - interval '2 days', now() + interval '12 days');
  INSERT INTO public.group_challenge_members (challenge_id, user_id, status, joined_at)
  VALUES (pg_temp.did(13, 1), tester, 'joined', now() - interval '10 days'),
         (pg_temp.did(13, 1), pg_temp.did(0, 1), 'joined', now() - interval '9 days'),
         (pg_temp.did(13, 1), pg_temp.did(0, 3), 'joined', now() - interval '9 days'),
         (pg_temp.did(13, 1), pg_temp.did(0, 5), 'joined', now() - interval '8 days'),
         (pg_temp.did(13, 1), pg_temp.did(0, 4), 'invited', now() - interval '8 days'),
         (pg_temp.did(13, 2), pg_temp.did(0, 2), 'joined', now() - interval '2 days'),
         (pg_temp.did(13, 2), pg_temp.did(0, 6), 'joined', now() - interval '1 day'),
         (pg_temp.did(13, 2), tester, 'invited', now() - interval '1 day');
  INSERT INTO public.notifications (id, user_id, type, title, body, read, action_url, created_at)
  VALUES (pg_temp.did(8, 20), tester, 'challenge', 'priya_p invited you to a challenge', 'Claim 10 zones · ends in 12 days', false, '/challenges', now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ── events: pace groups, arrivals, your bookmark ──
  UPDATE public.events SET pace_groups = ARRAY['5:00', '5:45', '6:30'] WHERE id IN (pg_temp.did(4, 1), pg_temp.did(4, 2));
  UPDATE public.event_participants ep
     SET pace_group = (ARRAY['5:00', '5:45', '6:30'])[1 + (('x' || right(ep.user_id::text, 4))::bit(16)::int % 3)]
   WHERE ep.event_id IN (pg_temp.did(4, 1), pg_temp.did(4, 2));
  INSERT INTO public.event_participants (event_id, user_id, joined_at, pace_group)
  VALUES (pg_temp.did(4, 1), tester, now() - interval '1 day', '5:45')
  ON CONFLICT (event_id, user_id) DO UPDATE SET pace_group = '5:45';
  INSERT INTO public.event_bookmarks (user_id, event_id) VALUES (tester, pg_temp.did(4, 5)), (tester, pg_temp.did(4, 2))
  ON CONFLICT DO NOTHING;

  -- ── a redeemed reward with its code ──
  INSERT INTO public.reward_codes (id, reward_id, code, assigned_to, assigned_at)
  VALUES (pg_temp.did(7, 9001), pg_temp.did(6, 1), 'RNV-DEMO-SOCKS', tester, now() - interval '3 days');
  INSERT INTO public.pace_redemptions (id, user_id, reward_id, pace_spent, fulfillment_code, fulfilled_at, created_at)
  VALUES (pg_temp.did(14, 1), tester, pg_temp.did(6, 1), 40, 'RNV-DEMO-SOCKS', now() - interval '3 days', now() - interval '3 days');

  -- ── saved public routes near home ──
  INSERT INTO public.saved_routes (id, user_id, name, emoji, distance_m, duration_sec, gps_points, is_public, created_at)
  SELECT pg_temp.did(15, r.k), r.owner, r.name, r.emoji, r.dist, r.secs,
         (SELECT jsonb_agg(jsonb_build_object(
                   'lat', ST_Y(pg_temp.pt(hlat, hlng, r.oy + r.rad * sin(radians(a)), r.ox + r.rad * cos(radians(a)))::geometry),
                   'lng', ST_X(pg_temp.pt(hlat, hlng, r.oy + r.rad * sin(radians(a)), r.ox + r.rad * cos(radians(a)))::geometry),
                   'timestamp', 0) ORDER BY a)
            FROM generate_series(0, 360, 15) a),
         true, now() - make_interval(days => r.k * 4)
    FROM (VALUES (1, pg_temp.did(0, 5), 'Lake loop', '🌊', 4200, 1500, 400.0, -300.0, 670.0),
                 (2, tester,             'Morning 5K', '🌅', 5000, 1680, -500.0, 600.0, 800.0)) AS r(k, owner, name, emoji, dist, secs, oy, ox, rad);

  RAISE NOTICE 'Demo data part 2 ready.';
END $$;

ALTER TABLE public.notifications ENABLE TRIGGER trg_notify_push;
COMMIT;
