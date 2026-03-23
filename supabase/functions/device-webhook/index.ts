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
}

// ─── Normalisers ──────────────────────────────────────────────────────────────

// Garmin sends an array under activityFiles or activities key
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseGarmin(payload: any): NormalisedActivity[] {
  const activities = payload.activities ?? payload.activityFiles ?? [];
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
function verifyGarminSig(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha1', secret).update(body).digest('hex');
  return expected === signature;
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

  // No match → only create run if it's a running activity with sufficient distance
  const RUNNING_TYPES = ['running', 'run', 'trail_running', 'track_running', 'RUNNING'];
  if (!RUNNING_TYPES.some(t => activity.activityType.includes(t))) return null;
  if (activity.distanceM < 500) return null;

  const { data: newRun } = await supabase
    .from('runs')
    .insert({
      user_id:         userId,
      distance_m:      activity.distanceM,
      duration_sec:    activity.durationSec,
      started_at:      activity.startedAt,
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

  return newRun?.id ?? null;
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
  if (provider === 'garmin') {
    const sig    = req.headers.get('x-garmin-signature') ?? '';
    const secret = Deno.env.get('GARMIN_WEBHOOK_SECRET') ?? '';
    if (secret && !verifyGarminSig(rawBody, sig, secret)) {
      return new Response('Invalid signature', { status: 401, headers: CORS });
    }
  }
  // Coros & Polar: verify via shared secret in query param or header
  // (implementation depends on their specific webhook docs)

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

  // ── Resolve user from device connection ───────────────────────────────────
  // Garmin sends a userId in the payload; Coros/Polar use a registered webhook per user.
  // For now, find user by provider_user_id stored in metadata.
  const results: Array<{ externalId: string; runId: string | null }> = [];

  for (const activity of activities) {
    try {
      // Look up user by provider user ID stored in metadata
      const { data: connections } = await supabase
        .from('device_connections')
        .select('user_id, metadata')
        .eq('device_type', provider)
        .eq('status', 'connected');

      if (!connections || connections.length === 0) continue;

      // For multi-user webhooks (Garmin), match by provider userId in payload
      // For now process first connected user (per-user webhook assumption for Coros/Polar)
      const userId = connections[0].user_id as string;

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
        raw_payload:      payload,
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

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
