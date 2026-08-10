import { createClient } from 'npm:@supabase/supabase-js@2';

const CORRIDOR_WIDTH_M    = 12;
const MAX_RUN_SPEED_MS    = 5.5;
const METERS_PER_DEG_LAT  = 111_320;
const MIN_GPS_POINTS      = 20;
const GPS_ACCURACY_THRESH = 50;
const GPS_VARIANCE_MIN    = 2.0;
const PACE_PER_NEW_ZONE   = 5;
const PACE_PER_STOLEN     = 10;
const FRESHNESS_STALE_AT  = 40;
const STEAL_THRESHOLD     = 0.30;

// Mirrors packages/shared/src/constants/awards.ts's titles — only what's needed
// for the "Achievement unlocked" push body, so this Deno function doesn't need
// a cross-package import for one string per award.
const AWARD_TITLES: Record<string, string> = {
  first_claim: 'First Claim', first_blood: 'First Blood', park_capture: 'Park Capture',
  district_owner: 'District Owner', quarter_owner: 'Quarter Owner', domain_lord: 'Domain Lord',
  city_builder: 'City Builder', defender: 'Defender', sovereign_rank: 'Sovereign',
  first_5k: 'First 5K', first_10k: '10K Club', first_halfmarathon: 'Half Done',
  km_100: '100km', km_500: '500km Club', km_1000: '1000km',
  streak_7: 'On Fire', streak_30: 'Unstoppable', early_bird: 'Early Bird',
  sub_5: 'Sub-5', sub_4_30: 'Sub-4:30', monthly_100: 'Century Month',
};
const PACE_WEEKLY_CAP_FREE    = 100; // mirrors claimEngine.ts GAME_CONFIG.PACE_WEEKLY_CAP_FREE
const PACE_WEEKLY_CAP_PREMIUM = 150; // mirrors claimEngine.ts GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM
const MAX_TERRITORIES_FREE    = 10;  // mirrors packages/shared/src/services/config.ts GAME_CONFIG.MAX_TERRITORIES_FREE
const MIN_MEANINGFUL_RUN_DISTANCE_M = 50; // mirrors GAME_CONFIG.MIN_MEANINGFUL_RUN_DISTANCE_M

// ── Geometry helpers (mirrored from claimEngine.ts for Deno) ──────────────────

interface Pt { lat: number; lng: number; timestamp: number; speed: number; accuracy: number; altitude: number; }
interface ValidPt { lat: number; lng: number; timestamp: number; speed: number; }

function filterPoints(pts: Pt[]): ValidPt[] {
  const acc = pts.filter(p => p.accuracy <= GPS_ACCURACY_THRESH);
  if (acc.length < 4) return [];
  const lats = acc.map(p => p.lat);
  const mean = lats.reduce((s, v) => s + v, 0) / lats.length;
  const variance = lats.reduce((s, v) => s + (v - mean) ** 2, 0) / lats.length;
  if (variance < GPS_VARIANCE_MIN * 1e-10) return [];
  return acc.map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp, speed: p.speed }));
}

function stripFast(pts: ValidPt[]): ValidPt[][] {
  const segs: ValidPt[][] = [];
  let cur: ValidPt[] = [];
  for (const p of pts) {
    if (p.speed <= MAX_RUN_SPEED_MS) { cur.push(p); }
    else { if (cur.length >= 3) segs.push(cur); cur = []; }
  }
  if (cur.length >= 3) segs.push(cur);
  return segs;
}

function kalman(pts: ValidPt[]): ValidPt[] {
  if (!pts.length) return [];
  const Q = 1e-5, R = 1e-4;
  let latE = pts[0].lat, lngE = pts[0].lng, P = 1.0;
  return pts.map(p => {
    const Pp = P + Q, K = Pp / (Pp + R);
    latE = latE + K * (p.lat - latE);
    lngE = lngE + K * (p.lng - lngE);
    P = (1 - K) * Pp;
    return { ...p, lat: latE, lng: lngE };
  });
}

function corridor(seg: ValidPt[]): [number, number][] {
  if (seg.length < 2) return [];
  const LAT_M = METERS_PER_DEG_LAT;
  const LNG_M = LAT_M * Math.cos(seg[0].lat * Math.PI / 180);
  const dLat  = CORRIDOR_WIDTH_M / LAT_M;
  const dLng  = CORRIDOR_WIDTH_M / LNG_M;
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i < seg.length; i++) {
    const prev = seg[Math.max(0, i - 1)], next = seg[Math.min(seg.length - 1, i + 1)];
    const dlat = (next.lat - prev.lat) / LAT_M, dlng = (next.lng - prev.lng) / LNG_M;
    const len = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
    // Left-perpendicular (CCW 90°) of tangent (dlng, dlat) is (-dlat, dlng), not
    // (-dlng, dlat) — the old formula wasn't perpendicular at all (dot product
    // dlat²-dlng² ≠ 0 except at exactly 45°), producing zero-width/self-overlapping
    // corridors for north-south or east-west runs. Mirrors the client-side fix in
    // packages/shared/src/services/claimEngine.ts's buildCorridorPolygon.
    const px = -dlat / len, py = dlng / len;
    L.push([seg[i].lng + px * dLng, seg[i].lat + py * dLat]);
    R.push([seg[i].lng - px * dLng, seg[i].lat - py * dLat]);
  }
  return [...L, ...[...R].reverse(), L[0]];
}

function buildPolygon(rawPts: Pt[], activityType: string): [number, number][] | null {
  if (activityType !== 'run' || rawPts.length < MIN_GPS_POINTS) return null;
  const filtered = filterPoints(rawPts);
  if (filtered.length < MIN_GPS_POINTS) return null;
  const segs = stripFast(filtered);
  if (!segs.length) return null;
  const smoothed = segs.map(kalman);
  const longest  = smoothed.reduce((a, b) => a.length > b.length ? a : b);
  return corridor(longest);
}

function polygonToWKT(ring: [number, number][]): string {
  const coords = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `POLYGON((${coords}))`;
}

function computeTierFromArea(m2: number): string {
  if (m2 < 5_000)   return 'patch';
  if (m2 < 50_000)  return 'block';
  if (m2 < 200_000) return 'district';
  if (m2 < 500_000) return 'quarter';
  return 'domain';
}

// ── Haversine distance (metres) ───────────────────────────────────────────────

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aa = sinLat * sinLat
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

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

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json() as {
    runId:            string;
    userId:           string;
    gpsPoints:        Pt[];
    activityType:     string;
    distanceKm:       number;
    durationSec?:     number;
    clientPaceEarned?: number;
  };

  if (body.userId !== user.id) return new Response('Forbidden', { status: 403 });

  // Anti-cheat: early exit guards
  if (!body.gpsPoints || body.gpsPoints.length < 10) {
    return new Response(JSON.stringify({ error: 'insufficient_gps' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const durationSec = body.durationSec ?? 0;
  if (durationSec < 60) {
    return new Response(JSON.stringify({ error: 'run_too_short' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Server-side distance from accuracy-filtered GPS points
  const filteredPts = filterPoints(body.gpsPoints);
  let serverDistanceKm = 0;
  for (let i = 1; i < filteredPts.length; i++) {
    serverDistanceKm += haversineM(filteredPts[i - 1], filteredPts[i]) / 1000;
  }

  // Fetch attacker profile (username + PACE cap data + subscription tier)
  const { data: attackerProfile } = await supabase
    .from('profiles')
    .select('username, pace_weekly_earned, pace_weekly_reset_at, streak_days, last_run_date, subscription_tier')
    .eq('id', user.id)
    .single();

  const attackerUsername  = (attackerProfile as { username: string | null } | null)?.username ?? 'A rival runner';
  // If the stored accumulator is from a previous UTC week, apply_pace_adjustment
  // (below) will reset it — treat the cap check here as if it already had, so a
  // run that lands right at the week boundary isn't wrongly capped by last
  // week's total before the reset takes effect.
  const weekStart = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(),
    new Date().getUTCDate() - ((new Date().getUTCDay() + 6) % 7),
  ));
  const paceWeeklyResetAt = (attackerProfile as { pace_weekly_reset_at: string | null } | null)?.pace_weekly_reset_at;
  const weekIsStale       = !paceWeeklyResetAt || new Date(paceWeeklyResetAt) < weekStart;
  const weeklyEarned      = weekIsStale ? 0 : ((attackerProfile as { pace_weekly_earned: number } | null)?.pace_weekly_earned ?? 0);
  const subscriptionTier  = (attackerProfile as { subscription_tier: string | null } | null)?.subscription_tier ?? 'free';

  // Server-authoritative streak — streak_days feeds the PACE streak bonus below, so
  // it can't be trusted from the client. Both streak_days and last_run_date are
  // client-writable via the profiles upsert (packages/shared/src/services/sync.ts
  // pushProfile — kept there only for legacy/offline-display reasons) and are now
  // ALSO locked server-side against non-service-role writes (see the
  // lock_streak_columns migration), so this is the sole place either is advanced.
  // Uses UTC calendar days (the server has no notion of the user's timezone) —
  // this can occasionally disagree by a day with the client's local-date optimistic
  // streak; pullProfile() reconciles it back, same as every other PACE field.
  const priorStreakDays  = (attackerProfile as { streak_days: number | null } | null)?.streak_days ?? 0;
  const priorLastRunDate = (attackerProfile as { last_run_date: string | null } | null)?.last_run_date ?? null;
  const todayUTC     = new Date().toISOString().slice(0, 10);
  const yesterdayUTC = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const meetsMinimumEffort = (serverDistanceKm * 1000) >= MIN_MEANINGFUL_RUN_DISTANCE_M;

  let streakDays  = priorStreakDays;
  let newRunDate  = priorLastRunDate;
  if (meetsMinimumEffort && priorLastRunDate !== todayUTC) {
    streakDays = priorLastRunDate === yesterdayUTC ? priorStreakDays + 1 : 1;
    newRunDate = todayUTC;
  }
  if (streakDays !== priorStreakDays || newRunDate !== priorLastRunDate) {
    await supabase.from('profiles').update({ streak_days: streakDays, last_run_date: newRunDate }).eq('id', user.id);
  }

  // Server-authoritative lifetime stats — total_distance_km/total_runs are locked
  // against direct client writes (lock_run_stat_columns.sql) because clubService.ts
  // ranks club leaderboards on total_distance_km with no other server recomputation;
  // this atomic RPC, run with the service_role key, is now the only write that sticks.
  await supabase.rpc('increment_run_stats', {
    p_user_id: user.id,
    p_distance_km: serverDistanceKm,
  });

  // Server-authoritative cap — mirrors claimEngine.ts calculateRunPACE's isPremium branch.
  // subscription_tier is set by the RevenueCat/Stripe webhooks (rc-webhook, stripe-webhook).
  const weeklyCap         = subscriptionTier === 'premium' ? PACE_WEEKLY_CAP_PREMIUM : PACE_WEEKLY_CAP_FREE;

  // Server-authoritative free-tier territory cap — client-side gating alone is
  // bypassable, so new claims/steals are refused here regardless of what the
  // client sent. Defending already-owned territory is never capped.
  const { count: ownedTerritoryCount } = await supabase
    .from('territory_polygons')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id);
  const atTerritoryCap = subscriptionTier !== 'premium'
    && (ownedTerritoryCount ?? 0) >= MAX_TERRITORIES_FREE;

  // Territory processing
  const ring = buildPolygon(body.gpsPoints, body.activityType);

  let stolenZones        = 0;
  let newZonesClaimed    = 0;
  let defendedStaleZones = 0;
  const stolenFromUserIds: string[] = [];

  interface StealRecord {
    rivalOwnerId:   string;
    rivalOwnerName: string;
    stolenAreaM2:   number;
    tier:           string;
    territoryId:    string;
  }
  const stealRecords: StealRecord[] = [];
  // Pilot instrumentation: every rival-overlap detection this run, qualifying
  // or not — without this, "contested-run rate" has no denominator (only
  // completed steals were ever persisted before). Best-effort, non-blocking.
  const contestLogRows: {
    run_id: string; user_id: string; rival_owner_id: string;
    overlap_pct: number; qualified: boolean;
  }[] = [];

  if (ring) {
    const wkt = polygonToWKT(ring);

    // Free-tier runners at the territory cap can still run and defend what they
    // already own, but cannot expand — neither by claiming unclaimed area nor by
    // stealing a rival's. Gated here (not just client-side) since a client-only
    // check is trivially bypassable.
    if (!atTerritoryCap) {
      // Find rival territory_polygons that intersect the new polygon
      const { data: rivals } = await supabase.rpc('find_intersecting_territories', {
        p_wkt: wkt,
        p_owner_id: user.id,
      });

      const rivalRows = (rivals ?? []) as {
        id: string;
        owner_id: string;
        freshness: number;
        area_m2: number;
        intersection_area: number;
      }[];

      // Batch-fetch rival usernames
      const rivalOwnerIds = [...new Set(rivalRows.map(r => r.owner_id))];
      const { data: rivalProfiles } = rivalOwnerIds.length > 0
        ? await supabase.from('profiles').select('id, username').in('id', rivalOwnerIds)
        : { data: [] };
      const rivalUsernameMap = new Map<string, string>(
        ((rivalProfiles ?? []) as { id: string; username: string | null }[]).map(p => [p.id, p.username ?? 'Runner'])
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

        stealRecords.push({
          rivalOwnerId:   rival.owner_id,
          rivalOwnerName: rivalUsernameMap.get(rival.owner_id) ?? 'Runner',
          stolenAreaM2:   rival.intersection_area,
          tier:           computeTierFromArea(rival.intersection_area),
          territoryId:    rival.id,
        });

        await supabase.rpc('steal_territory_portion', {
          p_rival_id:    rival.id,
          p_new_wkt:     wkt,
          p_new_owner:   user.id,
          p_run_id:      body.runId,
        });

        stolenZones++;
        if (!stolenFromUserIds.includes(rival.owner_id)) {
          stolenFromUserIds.push(rival.owner_id);
        }
      }

      if (contestLogRows.length > 0) {
        try {
          await supabase.from('run_territory_contests').insert(contestLogRows);
        } catch { /* non-critical — pilot instrumentation only */ }
      }

      const { data: claimedNew } = await supabase.rpc('claim_unclaimed_area', {
        p_wkt:      wkt,
        p_owner_id: user.id,
        p_run_id:   body.runId,
      });
      if (claimedNew) newZonesClaimed = 1;
    }

    // Checked BEFORE defend_own_territories bumps freshness, so this reflects
    // zones that were actually stale at the moment this run passed through them.
    const { data: staleDefended } = await supabase.rpc('count_defendable_stale_zones', {
      p_wkt:      wkt,
      p_owner_id: user.id,
      p_stale_at: FRESHNESS_STALE_AT,
    });
    defendedStaleZones = (staleDefended as number | null) ?? 0;

    await supabase.rpc('defend_own_territories', {
      p_wkt:      wkt,
      p_owner_id: user.id,
    });
  }

  // Server-authoritative PACE calculation
  const distancePace  = Math.floor(serverDistanceKm);                              // 1 PACE/km
  const zonePace      = newZonesClaimed * PACE_PER_NEW_ZONE + stolenZones * PACE_PER_STOLEN;
  const streakBonus   = streakDays > 0 && streakDays % 7 === 0 ? 3 : 0;
  const rawPace       = distancePace + zonePace + streakBonus;
  const remainingCap  = Math.max(0, weeklyCap - weeklyEarned);
  const serverPaceEarned = Math.min(rawPace, remainingCap);

  // Discrepancy logging (non-critical, silently skipped if table absent)
  const clientPaceEarned = body.clientPaceEarned ?? 0;
  if (Math.abs(clientPaceEarned - serverPaceEarned) > 2) {
    try {
      await supabase.from('pace_discrepancy_log').insert({
        user_id:         user.id,
        run_id:          body.runId,
        client_pace:     clientPaceEarned,
        server_pace:     serverPaceEarned,
        distance_km:     serverDistanceKm,
        gps_point_count: filteredPts.length,
        logged_at:       new Date().toISOString(),
      });
    } catch { /* non-critical */ }
  }

  // Apply authoritative PACE to player profile in DB
  if (serverPaceEarned > 0) {
    await supabase.rpc('apply_pace_adjustment', {
      p_user_id:    user.id,
      p_pace_delta: serverPaceEarned,
    });
  }

  // Generate feed battle cards — non-critical
  if (stealRecords.length > 0) {
    try {
      const feedOps: Promise<unknown>[] = [];

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
          distance_km:          body.distanceKm,
          pace_earned:          0,
          territory_tier:       steal.tier,
          territory_area_m2:    steal.stolenAreaM2,
          stolen_from_username: steal.rivalOwnerName,
          stolen_from_user_id:  steal.rivalOwnerId,
          zone_tier:            steal.tier,
          stolen_area_m2:       steal.stolenAreaM2,
          xp_earned:            0,
          leveled_up:           false,
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
          xp_earned:            0,
          leveled_up:           false,
          // Pilot instrumentation: links this notification to the actual
          // territory_polygons row taken, so a later query can check whether
          // the victim reclaimed this SAME spot — not just whether they ran
          // again somewhere.
          stolen_territory_id:  steal.territoryId,
          push_suppressed:      pushSuppressed,
        }));

        if (!pushSuppressed) {
          feedOps.push(supabase.functions.invoke('send-push-notification', {
            // send-push-notification reads user_id/action_url (snake_case) — the previous
            // userId/data.actionUrl keys never matched, so this call 400'd silently on
            // every steal and the "your territory is under attack" push never fired.
            body: {
              user_id:    steal.rivalOwnerId,
              title:      '⚔ Your territory is under attack',
              body:       `${attackerUsername} captured part of your ${steal.tier} zone. Defend it now.`,
              action_url: '/territory-map?filter=stale',
              // Lets send-push-notification apply the Territory alerts toggle —
              // this call bypasses the notifications-table trigger entirely, so
              // without this it would ignore that setting completely.
              type:       'zone_attacked',
            },
          }));
        }
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

  return new Response(JSON.stringify({
    territoryGenerated: ring !== null,
    newZonesClaimed,
    rivalZonesStolen: stolenZones,
    paceAdjustment: serverPaceEarned,
    stolenFromUserIds,
    territoryCapReached: atTerritoryCap,
    newAwards,
  }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
