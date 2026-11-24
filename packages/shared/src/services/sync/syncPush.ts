/**
 * Pushing locally recorded runs to Supabase, then handing each to server scoring
 * (syncScoring). Runs are immutable server-side, so an upload is insert-or-ignore and a
 * run that already uploaded is only retried for scoring.
 */
import { supabase } from '../supabase';
import { getRunsNeedingSync, saveRun } from '../store';
import { getAuthenticatedUser } from './syncAuth';
import { scoreRun } from './syncScoring';
import { uploadTrace } from './uploadTrace';

// postRunSync (after finish) and initialSync (app launch / recovery) can be triggered
// concurrently. Without this, both snapshot the same unsynced run before either marks it
// synced, and it gets pushed (and its territory processed) twice. Concurrent callers
// share the one in-flight push instead of starting a second one.
let _pushUnsyncedRunsInFlight: Promise<void> | null = null;

/** Push all locally unsynced runs to Supabase. */
export async function pushUnsyncedRuns(): Promise<void> {
  if (_pushUnsyncedRunsInFlight) return _pushUnsyncedRunsInFlight;
  _pushUnsyncedRunsInFlight = pushUnsyncedRunsImpl().finally(() => {
    _pushUnsyncedRunsInFlight = null;
  });
  return _pushUnsyncedRunsInFlight;
}

async function pushUnsyncedRunsImpl(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  // Also retry runs that uploaded but were never scored: the server is idempotent per
  // run, so a retry can never pay twice.
  const unsynced = await getRunsNeedingSync();
  if (unsynced.length === 0) return;

  let firstUploadError: unknown = null;
  for (const run of unsynced) {
    // Simplify the GPS track before upload: keeps route shape but drops redundant points
    // (1800-point run → ~60-120 points, ~95% size reduction). Whole milliseconds: iOS
    // reports fix times with a fraction (…321.3967), and the server orders the route by
    // (timestamp)::bigint, which rejected the whole run.
    const simplifiedPoints = uploadTrace(run.gpsPoints).map(p => ({ ...p, timestamp: Math.round(p.timestamp) }));

    // A run already uploaded is only retried for scoring: runs are immutable (there is no
    // UPDATE policy), so re-sending it as an upsert hit RLS and failed every later sync.
    // First uploads use ON CONFLICT DO NOTHING so a row that landed before a crash
    // doesn't fail the same way.
    const { error } = run.synced ? { error: null } : await supabase.from('runs').upsert({
      id: run.id,
      user_id: user.id,
      activity_type: run.activityType,
      started_at: new Date(run.startTime).toISOString(),
      finished_at: new Date(run.endTime).toISOString(),
      distance_m: run.distanceMeters,
      duration_sec: run.durationSec,
      avg_pace: run.avgPace,
      gps_points: simplifiedPoints,
      territories_claimed: run.territoriesClaimed,
      territories_fortified: run.territoriesFortified,
      xp_earned: run.xpEarned ?? 0,
      coins_earned: run.coinsEarned ?? 0,
      enemy_captured: run.enemyCaptured ?? 0,
      pre_run_level: run.preRunLevel ?? 1,
    }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      // Remember it and keep going: one run the server rejects must not block every run
      // queued behind it. It is thrown after the loop so withRetry + postRunSync still set
      // sync status to 'error' and surface "Could not upload run" instead of silently
      // discarding data.
      firstUploadError ??= error;
      continue;
    }

    // Treadmill runs are logged by hand and never scored: nothing to retry.
    const scored = run.serverProcessed === true || run.activityType === 'treadmill';
    await saveRun({ ...run, synced: true, serverProcessed: scored });
    // Scoring failing doesn't block the sync: PACE from stolen zones is credited on the
    // next successful one.
    await scoreRun(run, user);
  }
  if (firstUploadError) throw firstUploadError;
}
