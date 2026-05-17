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
    const px = -dlng / len, py = dlat / len;
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
    runId: string;
    userId: string;
    gpsPoints: Pt[];
    activityType: string;
    distanceKm: number;
  };

  if (body.userId !== user.id) return new Response('Forbidden', { status: 403 });

  const ring = buildPolygon(body.gpsPoints, body.activityType);
  if (!ring) {
    return new Response(JSON.stringify({
      territoryGenerated: false,
      newZonesClaimed: 0,
      rivalZonesStolen: 0,
      paceAdjustment: 0,
      stolenFromUserIds: [],
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const wkt = polygonToWKT(ring);

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

  // Batch-fetch rival usernames before the steal loop
  const rivalOwnerIds = [...new Set(rivalRows.map(r => r.owner_id))];
  const { data: rivalProfiles } = rivalOwnerIds.length > 0
    ? await supabase.from('profiles').select('id, username').in('id', rivalOwnerIds)
    : { data: [] };
  const rivalUsernameMap = new Map<string, string>(
    ((rivalProfiles ?? []) as { id: string; username: string | null }[]).map(p => [p.id, p.username ?? 'Runner'])
  );

  const { data: attackerProfile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single();
  const attackerUsername = (attackerProfile as { username: string | null } | null)?.username ?? 'A rival runner';

  interface StealRecord {
    rivalOwnerId:   string;
    rivalOwnerName: string;
    stolenAreaM2:   number;
    tier:           string;
  }
  const stealRecords: StealRecord[] = [];

  let stolenZones = 0;
  const stolenFromUserIds: string[] = [];
  let newZonesClaimed = 0;

  for (const rival of rivalRows) {
    const overlapPct = rival.area_m2 > 0 ? rival.intersection_area / rival.area_m2 : 0;
    const isFresh    = rival.freshness >= FRESHNESS_STALE_AT;
    const qualifies  = isFresh ? overlapPct > STEAL_THRESHOLD : overlapPct > 0;

    if (!qualifies) continue;

    stealRecords.push({
      rivalOwnerId:   rival.owner_id,
      rivalOwnerName: rivalUsernameMap.get(rival.owner_id) ?? 'Runner',
      stolenAreaM2:   rival.intersection_area,
      tier:           computeTierFromArea(rival.intersection_area),
    });

    // Clip the rival's polygon and insert the stolen portion for this user
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

  // Insert unclaimed corridor area (ST_Difference against all intersecting rivals)
  const { data: claimedNew } = await supabase.rpc('claim_unclaimed_area', {
    p_wkt:      wkt,
    p_owner_id: user.id,
    p_run_id:   body.runId,
  });
  if (claimedNew) newZonesClaimed = 1;

  // Refresh freshness on own polygons touched by this run
  await supabase.rpc('defend_own_territories', {
    p_wkt:      wkt,
    p_owner_id: user.id,
  });

  const paceAdjustment = newZonesClaimed * PACE_PER_NEW_ZONE + stolenZones * PACE_PER_STOLEN;

  // Apply PACE adjustment to player profile
  if (paceAdjustment > 0) {
    await supabase.rpc('apply_pace_adjustment', {
      p_user_id:   user.id,
      p_pace_delta: paceAdjustment,
    });
  }

  // Generate feed battle cards — non-critical, must never break territory processing
  if (stealRecords.length > 0) {
    try {
      const feedOps: Promise<unknown>[] = [];

      for (const steal of stealRecords) {
        // Conquest card — visible to attacker's followers
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

        // Attack card — private to victim (user_id = victim so get_feed only shows to auth.uid())
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
        }));

        // Push notification to victim
        feedOps.push(supabase.functions.invoke('send-push-notification', {
          body: {
            userId: steal.rivalOwnerId,
            title:  '⚔ Your territory is under attack',
            body:   `${attackerUsername} captured part of your ${steal.tier} zone. Defend it now.`,
            data:   { actionUrl: '/territory-map?filter=stale' },
          },
        }));
      }

      await Promise.allSettled(feedOps);
    } catch { /* non-critical */ }
  }

  return new Response(JSON.stringify({
    territoryGenerated: true,
    newZonesClaimed,
    rivalZonesStolen: stolenZones,
    paceAdjustment,
    stolenFromUserIds,
  }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
