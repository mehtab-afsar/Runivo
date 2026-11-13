/**
 * device-webhook — receives activity pushes from Garmin, Coros, Polar.
 *
 * POST /functions/v1/device-webhook?provider=garmin|coros|polar
 *
 * For each activity:
 *  1. Verify signature
 *  2. Normalise to a common shape
 *  3. Upsert into device_activities
 *  4. Try to match with existing run (±5 min window) → enrich or create run
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';
import { matchConnection } from './match.ts';
import { extractTrack, plausible, runivoSport, type TrackPoint } from './track.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-garmin-signature',
};

type Provider = 'garmin' | 'coros' | 'polar';

interface NormalisedActivity {
  externalId:     string;
  activityType:   string;
  startedAt:      string;   // ISO
  durationSec:    number;
  distanceM:      number;
  avgHr:          number | null;
  maxHr:          number | null;
  avgCadence:     number | null;
  elevationGainM: number | null;
  hrvMs:          number | null;
  caloriesKcal:   number | null;
  /** Who it belongs to, as the provider says (Garmin: userId + userAccessToken). */
  providerUserId?: string | null;
  providerToken?:  string | null;
  /** GPS track when the provider sent one (Garmin activity details). */
  track?: TrackPoint[];
}

// ─── Normalisers ──────────────────────────────────────────────────────────────

// Garmin sends an array under activityFiles or activities key
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseGarmin(payload: any): NormalisedActivity[] {
  // Activity details pushes carry the GPS samples next to a summary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (payload.activityDetails ?? []).map((d: any) => ({
    ...(d.summary ?? {}), activityId: d.activityId ?? d.summary?.activityId,
    userId: d.userId ?? d.summary?.userId, userAccessToken: d.userAccessToken ?? d.summary?.userAccessToken,
    __samples: d.samples ?? [],
  }));
  const activities = [...(payload.activities ?? payload.activityFiles ?? []), ...details];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return activities.map((a: any) => ({
    externalId:     String(a.activityId ?? a.activity_id),
    activityType:   (a.activityType ?? a.activity_type ?? 'RUNNING').toLowerCase(),
    startedAt:      new Date((a.startTimeInSeconds ?? a.start_time_in_seconds ?? 0) * 1000).toISOString(),
    durationSec:    a.durationInSeconds ?? a.duration_in_seconds ?? 0,
    distanceM:      (a.distanceInMeters ?? a.distance_in_meters ?? 0),
    avgHr:          a.averageHeartRateInBeatsPerMinute ?? a.average_heart_rate ?? null,
    maxHr:          a.maxHeartRateInBeatsPerMinute     ?? a.max_heart_rate     ?? null,
    avgCadence:     a.averageBikeCadenceInRoundsPerMinute ?? a.averageRunCadenceInStepsPerMinute ?? null,
    elevationGainM: a.totalElevationGainInMeters ?? null,
    hrvMs:          null,  // Garmin HRV comes via a separate HRV API
    caloriesKcal:   a.activeKilocalories ?? a.calories ?? null,
    providerUserId: a.userId != null ? String(a.userId) : null,
    providerToken:  a.userAccessToken != null ? String(a.userAccessToken) : null,
    track:          a.__samples ? extractTrack({ samples: a.__samples }, a.startTimeInSeconds ?? null) : [],
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseCoros(payload: any): NormalisedActivity[] {
  const data = payload.data ?? payload.activities ?? [];
  const list  = Array.isArray(data) ? data : [data];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.map((a: any) => ({
    externalId:     String(a.sportId ?? a.id ?? a.workoutId),
    activityType:   (a.sport ?? a.activityType ?? 'run').toLowerCase(),
    startedAt:      a.startTime ? new Date(Number(a.startTime) * 1000).toISOString() : new Date().toISOString(),
    durationSec:    a.duration   ?? 0,
    distanceM:      (a.distance  ?? 0) * 1000,  // Coros sends km
    avgHr:          a.avgHr      ?? a.averageHr ?? null,
    maxHr:          a.maxHr      ?? null,
    avgCadence:     a.avgCadence ?? null,
    elevationGainM: a.totalAscent ?? null,
    hrvMs:          null,
    caloriesKcal:   a.calorie    ?? null,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalisePolar(payload: any): NormalisedActivity[] {
  // Polar sends an event with exercise-url; for webhook enrichment we work with summary
  const exercises = payload.exercise ?? [payload];
  const list = Array.isArray(exercises) ? exercises : [exercises];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.map((a: any) => ({
    externalId:     String(a.id ?? a.exercise_id ?? ''),
    activityType:   (a.detailed_sport_info ?? a.sport ?? 'RUNNING').toLowerCase(),
    startedAt:      a.start_time ?? new Date().toISOString(),
    durationSec:    parseDuration(a.duration ?? 'PT0S'),
    distanceM:      a.distance    ?? 0,
    avgHr:          a.heart_rate?.average ?? null,
    maxHr:          a.heart_rate?.maximum ?? null,
    avgCadence:     a.speed?.avg          ?? null,
    elevationGainM: a.ascent              ?? null,
    hrvMs:          null,
    caloriesKcal:   a.calories            ?? null,
  }));
}

/** Parse ISO 8601 duration PT4H30M15S → seconds */
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0');
}

// ─── Signature verification ────────────────────────────────────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verifyGarminSig(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha1', secret).update(body).digest('hex');
  return timingSafeEqual(expected, signature);
}

// ─── Match or create run ───────────────────────────────────────────────────────
async function matchOrEnrichRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  activity: NormalisedActivity,
): Promise<string | null> {
  const startMs  = new Date(activity.startedAt).getTime();
  const windowMs = 5 * 60 * 1000; // 5 min

  // Look for an existing run within ±5 min of activity start
  const { data: runs } = await supabase
    .from('runs')
    .select('id, started_at, distance_m, avg_hr')
    .eq('user_id', userId)
    .gte('started_at', new Date(startMs - windowMs).toISOString())
    .lte('started_at', new Date(startMs + windowMs).toISOString())
    .order('started_at', { ascending: true })
    .limit(1);

  if (runs && runs.length > 0) {
    // Enrich the existing run with device data
    const runId = runs[0].id;
    const update: Record<string, unknown> = {};
    if (activity.avgHr && !runs[0].avg_hr) update.avg_hr = activity.avgHr;
    if (activity.maxHr)          update.max_hr          = activity.maxHr;
    if (activity.avgCadence)     update.avg_cadence      = activity.avgCadence;
    if (activity.elevationGainM) update.elevation_gain_m = activity.elevationGainM;
    if (activity.hrvMs)          update.hrv_ms           = activity.hrvMs;
    if (activity.caloriesKcal)   update.calories_kcal    = activity.caloriesKcal;

    if (Object.keys(update).length > 0) {
      await supabase.from('runs').update(update).eq('id', runId);
    }
    return runId;
  }

  // No match → create a run for sports we record, with sufficient distance.
  // The service role skips validate_run_distance, so the same ceilings are applied here (X3).
  const sport = runivoSport(activity.activityType);
  if (!sport) return null;
  if (activity.distanceM < 500) return null;
  if (!plausible(activity.distanceM, activity.durationSec, sport)) {
    console.warn(`[device-webhook] implausible ${sport}: ${activity.distanceM} m in ${activity.durationSec} s`);
    return null;
  }
  const track = activity.track ?? [];

  const { data: newRun } = await supabase
    .from('runs')
    .insert({
      user_id:         userId,
      distance_m:      activity.distanceM,
      duration_sec:    activity.durationSec,
      started_at:      activity.startedAt,
      finished_at:     new Date(new Date(activity.startedAt).getTime() + activity.durationSec * 1000).toISOString(),
      activity_type:   sport,
      // The integrity trigger (B7) checks this track like a phone run's.
      gps_points:      track.length ? track : null,
      avg_hr:          activity.avgHr,
      max_hr:          activity.maxHr,
      avg_cadence:     activity.avgCadence,
      elevation_gain_m: activity.elevationGainM,
      hrv_ms:          activity.hrvMs,
      calories_kcal:   activity.caloriesKcal,
      source:          'device_import',
      synced:          true,
    })
    .select('id')
    .single();

  if (newRun?.id && track.length >= 10) {
    await playTheGame(newRun.id, userId, track, sport, activity);
  }
  return newRun?.id ?? null;
}

/**
 * Score a new watch run exactly like a phone run: process-run-territory
 * verifies distance, applies the speed and teleport rules, claims or steals
 * zones and pays PACE. Called internally with the service key.
 */
async function playTheGame(runId: string, userId: string, track: TrackPoint[], sport: string, a: NormalisedActivity): Promise<void> {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-run-territory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'x-runivo-internal': 'device-webhook',
      },
      body: JSON.stringify({
        runId, userId, activityType: sport, gpsPoints: track,
        distanceKm: a.distanceM / 1000, durationSec: a.durationSec, clientPaceEarned: 0,
      }),
    });
    if (!res.ok) console.warn(`[device-webhook] territory for ${runId}: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.warn('[device-webhook] territory call failed:', err);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const urlObj   = new URL(req.url);
  const provider = urlObj.searchParams.get('provider') as Provider | null;

  if (!provider || !['garmin', 'coros', 'polar'].includes(provider)) {
    return new Response('Unknown provider', { status: 400, headers: CORS });
  }

  const rawBody = await req.text();

  // ── Signature checks ──────────────────────────────────────────────────────
  // Fail CLOSED when the secret isn't configured — previously an unset
  // GARMIN_WEBHOOK_SECRET skipped verification entirely, letting an
  // unauthenticated caller inject arbitrary "device" runs for any user_id.
  if (provider === 'garmin') {
    const sig    = req.headers.get('x-garmin-signature') ?? '';
    const secret = Deno.env.get('GARMIN_WEBHOOK_SECRET') ?? '';
    if (!secret) {
      return new Response('Webhook not configured', { status: 503, headers: CORS });
    }
    if (!verifyGarminSig(rawBody, sig, secret)) {
      return new Response('Invalid signature', { status: 401, headers: CORS });
    }
  }
  // Coros & Polar: no signature scheme is implemented yet (needs their specific
  // webhook docs) — reject rather than accept unauthenticated payloads.
  if (provider === 'coros' || provider === 'polar') {
    return new Response('Provider not yet supported', { status: 501, headers: CORS });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); }
  catch { return new Response('Invalid JSON', { status: 400, headers: CORS }); }

  // ── Normalise ──────────────────────────────────────────────────────────────
  let activities: NormalisedActivity[] = [];
  try {
    if (provider === 'garmin') activities = normaliseGarmin(payload);
    if (provider === 'coros')  activities = normaliseCoros(payload);
    if (provider === 'polar')  activities = normalisePolar(payload);
  } catch (err) {
    console.error('Normalise error:', err);
    return new Response('Could not parse payload', { status: 422, headers: CORS });
  }

  // ── Resolve the owner of each activity ────────────────────────────────────
  // One webhook serves every user, so each activity is matched to the single
  // connection whose token or provider user id it carries (./match.ts).
  // Unmatched or ambiguous activities are dropped, never assigned to someone else.
  const results: Array<{ externalId: string; runId: string | null }> = [];
  const skipped: Array<{ externalId: string; reason: string }> = [];

  const { data: connections } = await supabase
    .from('device_connections')
    .select('user_id, metadata, secrets')
    .eq('device_type', provider)
    .eq('status', 'connected');

  for (const activity of activities) {
    try {
      const match = matchConnection(connections ?? [], activity);
      if (!match.ok) {
        skipped.push({ externalId: activity.externalId, reason: match.reason });
        console.warn(`[device-webhook] ${provider} activity ${activity.externalId} skipped: ${match.reason}`);
        continue;
      }
      const userId = match.userId;
      if (match.learnProviderUserId) {
        const row = (connections ?? []).find(c => c.user_id === userId);
        await supabase
          .from('device_connections')
          .update({ metadata: { ...(row?.metadata ?? {}), provider_user_id: match.learnProviderUserId } })
          .eq('user_id', userId)
          .eq('device_type', provider);
      }

      // Upsert activity record
      await supabase.from('device_activities').upsert({
        user_id:          userId,
        device_type:      provider,
        external_id:      activity.externalId,
        activity_type:    activity.activityType,
        started_at:       activity.startedAt,
        duration_sec:     activity.durationSec,
        distance_m:       activity.distanceM,
        avg_hr:           activity.avgHr,
        max_hr:           activity.maxHr,
        avg_cadence:      activity.avgCadence,
        elevation_gain_m: activity.elevationGainM,
        hrv_ms:           activity.hrvMs,
        calories_kcal:    activity.caloriesKcal,
        // Only this activity, without the access token: the push body holds
        // every user's activities and tokens.
        raw_payload:      { provider, activity: { ...activity, providerToken: undefined } },
      }, { onConflict: 'device_type,external_id' });

      // Match or create run
      const runId = await matchOrEnrichRun(supabase, userId, activity);

      // Link activity → run
      if (runId) {
        await supabase
          .from('device_activities')
          .update({ run_id: runId })
          .eq('device_type', provider)
          .eq('external_id', activity.externalId);
      }

      // Update last_sync_at on the connection
      await supabase
        .from('device_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('device_type', provider);

      results.push({ externalId: activity.externalId, runId });

    } catch (err) {
      console.error(`Error processing activity ${activity.externalId}:`, err);
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results, skipped }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
