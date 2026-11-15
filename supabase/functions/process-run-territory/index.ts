import { createClient } from 'npm:@supabase/supabase-js@2';

import { effectiveTier } from '../_shared/subscriptions.ts';
import { MAX_GPS_POINTS, runMismatch, type StoredRunFacts } from './consistency.ts';
import {
  ENGINE,
  buildTerritoryShape,
  computeRunPace,
  isOnFoot,
  lineToWKT,
  ringToWKT,
  tierForArea,
  updateStreak,
  utcDay,
  verifiedDistance,
  weeklyCapFor,
  type EnginePoint,
} from '../_shared/runEngine.ts';

// Every game rule (distance, loop detection, PACE per km, caps, streak) lives
// in _shared/runEngine.ts, a byte-for-byte copy of the app's
// packages/shared/src/engine/runEngine.ts (enforced by runEngine.sync.test.ts).
// This function only adds what the app can't be trusted with: it verifies,
// writes, and pays.

const STEAL_THRESHOLD    = 0.30;
const FRESHNESS_STALE_AT = 40;
const MIN_GPS_POINTS     = 10;

// Mirrors packages/shared/src/constants/awards.ts's titles — only what's needed
// for the "Achievement unlocked" push body, so this Deno function doesn't need
// a cross-package import for one string per award.
const AWARD_TITLES: Record<string, string> = {
  first_claim: 'First Claim', first_blood: 'First Blood', park_capture: 'Loop Closer',
  district_owner: 'District Owner', quarter_owner: 'Quarter Owner', domain_lord: 'Domain Lord',
  city_builder: 'City Builder', defender: 'Defender', sovereign_rank: 'Sovereign',
  first_5k: 'First 5K', first_10k: '10K Club', first_halfmarathon: 'Half Done',
  km_100: '100km', km_500: '500km Club', km_1000: '1000km',
  streak_7: 'On Fire', streak_30: 'Unstoppable', early_bird: 'Early Bird',
  sub_5: 'Sub-5', sub_4_30: 'Sub-4:30', monthly_100: 'Century Month',
};
const MAX_TERRITORIES_FREE = 10; // mirrors GAME_CONFIG.MAX_TERRITORIES_FREE

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Watch runs (X3): the device webhook calls in with the service key for the
  // runner it already matched; everyone else must be the runner.
  const bearer = authHeader.replace('Bearer ', '');
  const internal = bearer === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') && req.headers.get('x-runivo-internal') === 'device-webhook';
  let user: { id: string } | null = null;
  const peek = await req.clone().json().catch(() => ({})) as { userId?: string };
  if (internal) {
    user = peek.userId ? { id: peek.userId } : null;
  } else {
    const { data, error: authErr } = await supabase.auth.getUser(bearer);
    if (!authErr && data.user) user = { id: data.user.id };
  }
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as {
    runId:             string;
    userId:            string;
    gpsPoints:         EnginePoint[];
    activityType:      string;
    distanceKm?:       number;
    durationSec?:      number;
    clientPaceEarned?: number;
    /** The device reported mock/simulated location during the run. */
    mockedLocation?:   boolean;
  };

  if (body.userId !== user.id) return new Response('Forbidden', { status: 403 });
  if (!body.runId) return json({ error: 'missing_run_id' }, 400);
  // Bound the work one request can demand before any query runs.
  if (Array.isArray(body.gpsPoints) && body.gpsPoints.length > MAX_GPS_POINTS) {
    return json({ error: 'trace_too_large' }, 413);
  }

  // The run must already be synced and belong to this runner — no PACE for
  // made-up run ids — and what the request claims must agree with that row.
  const { data: runRow, error: runErr } = await supabase
    .from('runs')
    .select('id, user_id, activity_type, duration_sec, started_at, finished_at')
    .eq('id', body.runId).maybeSingle();
  if (runErr) return json({ error: 'run_lookup_failed' }, 500);
  const storedRun = runRow as (StoredRunFacts & { id: string; user_id: string }) | null;
  if (!storedRun || storedRun.user_id !== user.id) return json({ error: 'run_not_found' }, 404);
  if (Array.isArray(body.gpsPoints)) {
    const mismatch = runMismatch(storedRun, {
      activityType: body.activityType, durationSec: body.durationSec, gpsPoints: body.gpsPoints,
    });
    if (mismatch) return json({ error: 'run_mismatch', reason: mismatch }, 422);
  }

  // Claim the run. A replay (retry, double sync, crafted request) gets the
  // stored result back and changes nothing.
  const { error: claimErr } = await supabase
    .from('run_processing').insert({ run_id: body.runId, user_id: user.id });
  if (claimErr) {
    const { data: prior } = await supabase
      .from('run_processing').select('result').eq('run_id', body.runId).maybeSingle();
    const stored = (prior as { result: unknown } | null)?.result;
    if (stored) return json({ ...(stored as object), replayed: true });
    return json({ error: 'run_in_progress' }, 409);
  }

  // From here on, a failure releases the claim so the app can retry.
  const release = async (error: string, status = 500) => {
    await supabase.from('run_processing').delete().eq('run_id', body.runId);
    return json({ error }, status);
  };

  // The phone saw mock/simulated location. The run stays on the runner's
  // history, but earns nothing and claims nothing. Recorded as scored, so the
  // app stops retrying and drops the PACE it showed optimistically.
  if (body.mockedLocation === true) {
    const flagged = {
      territoryGenerated: false, territoryWkt: null, territoryAreaM2: 0, claimedAreaM2: 0, isLoop: false,
      newZonesClaimed: 0, rivalZonesStolen: 0, verifiedDistanceKm: 0, paceAdjustment: 0, paceBreakdown: {},
      paceCapped: false, streakDays: 0, stolenFromUserIds: [] as string[], territoryCapReached: false,
      newAwards: [] as string[], flagged: 'mock_location',
    };
    try {
      await supabase.from('pace_discrepancy_log').insert({
        user_id: user.id, run_id: body.runId, client_pace: body.clientPaceEarned ?? 0, server_pace: 0,
        distance_km: 0, gps_point_count: Array.isArray(body.gpsPoints) ? body.gpsPoints.length : 0,
        logged_at: new Date().toISOString(),
      });
    } catch { /* instrumentation only */ }
    await supabase.from('run_processing').update({ result: flagged }).eq('run_id', body.runId);
    return json(flagged);
  }

  if (!Array.isArray(body.gpsPoints) || body.gpsPoints.length < MIN_GPS_POINTS) {
    return release('insufficient_gps', 400);
  }
  const durationSec = Math.max(0, Number(body.durationSec) || 0);
  if (durationSec < ENGINE.MIN_RUN_DURATION_S) return release('run_too_short', 400);

  // Distance from the trace itself: bad fixes and teleports dropped, then
  // capped at what a person could cover in the recorded time.
  const onFoot = isOnFoot(body.activityType);
  const { distanceM } = verifiedDistance(body.gpsPoints, durationSec, body.activityType);
  const serverDistanceKm = distanceM / 1000;

  const { data: attackerProfile, error: profErr } = await supabase
    .from('profiles')
    .select('username, pace_weekly_earned, pace_weekly_reset_at, streak_days, last_run_date, subscription_tier')
    .eq('id', user.id)
    .single();
  if (profErr || !attackerProfile) return release('profile_not_found');
  const prof = attackerProfile as {
    username: string | null; pace_weekly_earned: number | null; pace_weekly_reset_at: string | null;
    streak_days: number | null; last_run_date: string | null; subscription_tier: string | null;
  };
  const attackerUsername = prof.username ?? 'A rival runner';
  // Plus for everyone while subscriptions are off (_shared/subscriptions.ts).
  const subscriptionTier = effectiveTier(prof.subscription_tier);
  const isPremium        = weeklyCapFor(subscriptionTier) > ENGINE.PACE_WEEKLY_CAP_FREE;

  // Streak: only the first meaningful run of a UTC day moves it.
  const streak = updateStreak({
    streakDays: prof.streak_days ?? 0,
    lastRunDay: prof.last_run_date,
    today:      utcDay(Date.now()),
    // Rides are recorded but don't move the running streak.
    meaningful: onFoot && distanceM >= ENGINE.MIN_MEANINGFUL_RUN_DISTANCE_M,
  });
  if (streak.advanced) {
    const { error } = await supabase.from('profiles')
      .update({ streak_days: streak.streakDays, last_run_date: streak.lastRunDay }).eq('id', user.id);
    if (error) return release('streak_update_failed');
  }

  // (Profile km / run counts are bumped at the very end, once nothing below can
  // release the claim: doing it here counted a run again on every retry.)

  // Free accounts at the zone limit can still run and defend, not expand.
  const { count: ownedTerritoryCount } = await supabase
    .from('territory_polygons').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
  const atTerritoryCap = !isPremium && (ownedTerritoryCount ?? 0) >= MAX_TERRITORIES_FREE;

  // Territory: the engine picks loop or strip; PostGIS builds the real shape.
  const shape = buildTerritoryShape(body.gpsPoints, body.activityType);
  let territoryWkt: string | null = null;
  let territoryAreaM2 = 0;
  let isLoop = false;
  if (shape) {
    const { data: geom, error } = await supabase.rpc('build_territory_geom', {
      p_line_wkt: lineToWKT(shape.line),
      p_ring_wkt: shape.ring ? ringToWKT(shape.ring) : null,
    });
    if (error) return release('geometry_failed');
    const g = (Array.isArray(geom) ? geom[0] : geom) as { wkt: string | null; area_m2: number; is_loop: boolean } | null;
    if (g?.wkt && g.area_m2 >= ENGINE.MIN_TERRITORY_AREA_M2) {
      territoryWkt = g.wkt;
      territoryAreaM2 = g.area_m2;
      isLoop = g.is_loop;
    }
  }

  let stolenZones        = 0;
  let newZonesClaimed    = 0;
  let claimedAreaM2      = 0;
  let defendedStaleZones = 0;
  const stolenFromUserIds: string[] = [];

  interface StealRecord {
    rivalOwnerId: string; rivalOwnerName: string; stolenAreaM2: number; tier: string; territoryId: string;
  }
  const stealRecords: StealRecord[] = [];
  const contestLogRows: {
    run_id: string; user_id: string; rival_owner_id: string; overlap_pct: number; qualified: boolean;
  }[] = [];

  if (territoryWkt) {
    const wkt = territoryWkt;

    if (!atTerritoryCap) {
      const { data: rivals, error: findErr } = await supabase.rpc('find_intersecting_territories', {
        p_wkt: wkt, p_owner_id: user.id,
      });
      if (findErr) return release('territory_lookup_failed');

      const rivalRows = (rivals ?? []) as {
        id: string; owner_id: string; freshness: number; area_m2: number; intersection_area: number;
      }[];

      const rivalOwnerIds = [...new Set(rivalRows.map(r => r.owner_id))];
      const { data: rivalProfiles } = rivalOwnerIds.length > 0
        ? await supabase.from('profiles').select('id, username').in('id', rivalOwnerIds)
        : { data: [] };
      const rivalUsernameMap = new Map<string, string>(
        ((rivalProfiles ?? []) as { id: string; username: string | null }[]).map(p => [p.id, p.username ?? 'Runner']),
      );

      for (const rival of rivalRows) {
        const overlapPct = rival.area_m2 > 0 ? rival.intersection_area / rival.area_m2 : 0;
        const isFresh    = rival.freshness >= FRESHNESS_STALE_AT;
        const qualifies  = isFresh ? overlapPct > STEAL_THRESHOLD : overlapPct > 0;
        contestLogRows.push({
          run_id: body.runId, user_id: user.id, rival_owner_id: rival.owner_id,
          overlap_pct: overlapPct, qualified: qualifies,
        });
        if (!qualifies) continue;

        const { data: moved, error: stealErr } = await supabase.rpc('steal_territory_portion', {
          p_rival_id: rival.id, p_new_wkt: wkt, p_new_owner: user.id, p_run_id: body.runId,
        });
        if (stealErr) return release('steal_failed');
        const stolenAreaM2 = Number(moved) || 0;
        // Only ground that actually changed hands counts (and pays).
        if (stolenAreaM2 <= 0) continue;

        stealRecords.push({
          rivalOwnerId:   rival.owner_id,
          rivalOwnerName: rivalUsernameMap.get(rival.owner_id) ?? 'Runner',
          stolenAreaM2,
          tier:           tierForArea(stolenAreaM2),
          territoryId:    rival.id,
        });
        stolenZones++;
        if (!stolenFromUserIds.includes(rival.owner_id)) stolenFromUserIds.push(rival.owner_id);
      }

      if (contestLogRows.length > 0) {
        try { await supabase.from('run_territory_contests').insert(contestLogRows); } catch { /* instrumentation only */ }
      }

      const { data: claimed, error: claimAreaErr } = await supabase.rpc('claim_unclaimed_area', {
        p_wkt: wkt, p_owner_id: user.id, p_run_id: body.runId, p_is_loop: isLoop,
      });
      if (claimAreaErr) return release('claim_failed');
      const c = (Array.isArray(claimed) ? claimed[0] : claimed) as { pieces: number; area_m2: number } | null;
      // One run claims one zone, however many pieces the free land came in.
      if (c && c.pieces > 0) { newZonesClaimed = 1; claimedAreaM2 = c.area_m2; }
    }

    // Counted before defending, so it reflects zones that were stale when the run passed.
    const { data: staleDefended } = await supabase.rpc('count_defendable_stale_zones', {
      p_wkt: wkt, p_owner_id: user.id, p_stale_at: FRESHNESS_STALE_AT,
    });
    defendedStaleZones = (staleDefended as number | null) ?? 0;

    const { error: defendErr } = await supabase.rpc('defend_own_territories', { p_wkt: wkt, p_owner_id: user.id });
    if (defendErr) return release('defend_failed');
  }

  // PACE: the engine's rules; the ledger applies the weekly cap atomically
  // and pays each run once.
  const pace = computeRunPace({
    distanceM,
    newZones:       newZonesClaimed,
    stolenZones,
    streakAdvanced: streak.advanced,
    streakDays:     streak.streakDays,
    weeklyEarned:   0, // the ledger knows the live weekly total; it caps
    tier:           subscriptionTier,
    activityType:   body.activityType,
  });
  let serverPaceEarned = 0;
  if (pace.raw > 0) {
    const { data: credited, error: creditErr } = await supabase.rpc('credit_pace_capped', {
      p_user_id: user.id, p_amount: pace.raw, p_source: 'run', p_source_key: body.runId,
    });
    if (creditErr) return release('pace_credit_failed');
    serverPaceEarned = Number(credited) || 0;
  }

  // E6: zones claimed inside a live territory event earn their zone PACE twice.
  const zonePace = pace.breakdown.newZones + pace.breakdown.stolenZones;
  if (zonePace > 0) {
    const first = body.gpsPoints[0] as { lat: number; lng: number; timestamp?: number };
    const at = new Date(Number(first.timestamp) || Date.now()).toISOString();
    const { data: mult } = await supabase.rpc('territory_event_multiplier', { p_user: user.id, p_at: at, p_lat: first.lat, p_lng: first.lng });
    if (Number(mult) > 1) {
      const { data: bonus } = await supabase.rpc('credit_pace_capped', {
        p_user_id: user.id, p_amount: zonePace * (Number(mult) - 1), p_source: 'territory_event', p_source_key: body.runId,
      });
      serverPaceEarned += Number(bonus) || 0;
    }
  }

  const clientPaceEarned = body.clientPaceEarned ?? 0;
  if (Math.abs(clientPaceEarned - serverPaceEarned) > 2) {
    try {
      await supabase.from('pace_discrepancy_log').insert({
        user_id: user.id, run_id: body.runId, client_pace: clientPaceEarned, server_pace: serverPaceEarned,
        distance_km: serverDistanceKm, gps_point_count: body.gpsPoints.length, logged_at: new Date().toISOString(),
      });
    } catch { /* non-critical */ }
  }

  // Generate feed battle cards — non-critical
  if (stealRecords.length > 0) {
    try {
      const feedOps: PromiseLike<unknown>[] = [];

      for (const steal of stealRecords) {
        // Pilot A/B: randomly withhold the proactive "under attack" push for
        // ~half of steals, so the pilot can measure how much of the reclaim
        // behaviour the push itself drives. A suppressed victim still sees the
        // attack in their feed on next open — this isolates the value of the
        // ALERT, not of awareness. Remove this randomisation (always notify)
        // once the pilot readout is done.
        const pushSuppressed = Math.random() < 0.5;

        feedOps.push(supabase.from('feed_posts').insert({
          user_id:              body.userId,
          post_type:            'conquest',
          run_id:               body.runId,
          distance_km:          serverDistanceKm,
          pace_earned:          0,
          territory_tier:       steal.tier,
          territory_area_m2:    steal.stolenAreaM2,
          stolen_from_username: steal.rivalOwnerName,
          stolen_from_user_id:  steal.rivalOwnerId,
          zone_tier:            steal.tier,
          stolen_area_m2:       steal.stolenAreaM2,
        }));

        feedOps.push(supabase.from('feed_posts').insert({
          user_id:              steal.rivalOwnerId,
          post_type:            'attack',
          run_id:               body.runId,
          distance_km:          0,
          pace_earned:          0,
          territory_tier:       steal.tier,
          territory_area_m2:    steal.stolenAreaM2,
          stolen_from_username: attackerUsername,
          stolen_from_user_id:  body.userId,
          zone_tier:            steal.tier,
          stolen_area_m2:       steal.stolenAreaM2,
          // Pilot instrumentation: links this notification to the actual
          // territory_polygons row taken, so a later query can check whether
          // the victim reclaimed this SAME spot — not just whether they ran
          // again somewhere.
          stolen_territory_id:  steal.territoryId,
          push_suppressed:      pushSuppressed,
        }));

        // In-app row for the rival; its insert trigger sends the push (with
        // the Territory alerts setting applied) unless the pilot withholds it.
        feedOps.push(supabase.from('notifications').insert({
          user_id:    steal.rivalOwnerId,
          type:       'zone_attacked',
          title:      'Your territory is under attack',
          body:       `${attackerUsername} captured part of your ${steal.tier} zone. Defend it now.`,
          action_url: '/territory-map?filter=stale',
          dedupe_key: `zone_attacked:${body.runId}:${steal.territoryId}`,
          silent:     pushSuppressed,
        }));
      }

      await Promise.allSettled(feedOps);
    } catch { /* non-critical */ }
  }

  // Awards — this is now the ONLY place awards are granted. Previously the
  // client computed eligibility itself and inserted directly into user_awards;
  // RLS only checked user_id = auth.uid(), never the award, so any signed-in
  // user could grant themselves any award via a direct REST call. first_blood
  // and defender are granted here because they're tied to what this run's
  // server-verified geometry just proved happened (stolenZones/defendedStaleZones
  // are computed above from real intersection checks, not client input); every
  // threshold-based award (distance, streak, territory tier, rank, ...) is
  // re-derived fresh from current-state tables by sync_user_awards regardless of
  // whether this run touched territory at all.
  const newAwards: string[] = [];
  if (stolenZones > 0) {
    const { data: granted } = await supabase.rpc('grant_award', { p_user_id: user.id, p_award_id: 'first_blood' });
    if (granted) newAwards.push('first_blood');
  }
  if (defendedStaleZones > 0) {
    const { data: granted } = await supabase.rpc('grant_award', { p_user_id: user.id, p_award_id: 'defender' });
    if (granted) newAwards.push('defender');
  }
  const { data: syncedAwards } = await supabase.rpc('sync_user_awards', { p_user_id: user.id });
  if (Array.isArray(syncedAwards)) newAwards.push(...(syncedAwards as string[]));

  // Achievement push — inserting into `notifications` (rather than invoking
  // send-push-notification directly, like the steal alert above) reuses the
  // existing trigger fan-out and gives the user an in-app notification-feed
  // record too, not just a transient push. The Announce achievements toggle
  // is enforced by send-push-notification reading this row's `type`.
  if (newAwards.length > 0) {
    try {
      await supabase.from('notifications').insert(
        newAwards.map(awardId => ({
          user_id: user.id,
          type: 'achievement',
          title: 'Achievement unlocked',
          body: `You earned "${AWARD_TITLES[awardId] ?? awardId}"`,
          action_url: '/profile',
        }))
      );
    } catch { /* non-critical */ }
  }

  const result = {
    territoryGenerated: territoryWkt !== null,
    territoryWkt,
    territoryAreaM2,
    claimedAreaM2,
    isLoop,
    newZonesClaimed,
    rivalZonesStolen: stolenZones,
    verifiedDistanceKm: serverDistanceKm,
    paceAdjustment: serverPaceEarned,
    paceBreakdown: pace.breakdown,
    paceCapped: serverPaceEarned < pace.raw,
    streakDays: streak.streakDays,
    stolenFromUserIds,
    territoryCapReached: atTerritoryCap,
    newAwards,
  };
  // Profile km and run counts are on-foot only (rides are tracked separately).
  // Last on purpose: every step above can release the claim and be retried, and
  // this one is not idempotent. A failure here is logged, not retried, so the
  // runner's PACE is never held up (or double-counted) over a stats counter.
  if (onFoot) {
    const { error: statsErr } = await supabase.rpc('increment_run_stats', {
      p_user_id: user.id, p_distance_km: serverDistanceKm,
    });
    if (statsErr) console.error('[process-run-territory] increment_run_stats failed', body.runId, statsErr.message);
  }

  await supabase.from('run_processing').update({ result }).eq('run_id', body.runId);
  return json(result);
});
