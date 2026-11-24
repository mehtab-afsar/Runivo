/** The two sync entry points the app calls: once at boot, and after every finished run. */
import { pullProfile, pushProfile } from './syncProfile';
import { pullRuns, pullTerritories } from './syncPull';
import { pullSavedRoutes, pushSavedRoutes } from './syncRoutes';
import { pushNutritionLogs, pushNutritionProfile } from './syncNutrition';
import { pushUnsyncedRuns } from './syncPush';
import { reportSyncError, setSyncStatus, withRetry } from './syncQueue';

/**
 * Run all pulls on startup, then push anything recorded offline. Non-fatal: each step is
 * settled on its own, so one failing never stops the others.
 */
export async function initialSync(): Promise<void> {
  await Promise.allSettled([
    pullProfile(),
    pullRuns(),
    pullTerritories(),
    pullSavedRoutes(),
  ]);
  // Push any runs/routes/nutrition data recorded offline
  await Promise.allSettled([
    pushUnsyncedRuns(),
    pushSavedRoutes(),
    pushNutritionLogs(),
    pushNutritionProfile(),
  ]);
}

/** Call after finishing a run to persist everything. Returns {ok:false} on failure (the run is safe locally). */
export async function postRunSync(): Promise<{ ok: boolean }> {
  setSyncStatus('syncing');
  try {
    // 1. Push run first — DB trigger fires, increments total_runs / total_distance_km
    await withRetry(() => pushUnsyncedRuns());
    // 2. Push saved routes (non-blocking for XP correctness, but keep sequential)
    await pushSavedRoutes();
    // 3. Push local XP / coins / diamonds before any pull can overwrite them
    await withRetry(() => pushProfile());
    // 4. Brief settle window so the DB trigger result is visible on next read
    await new Promise<void>(r => setTimeout(r, 400));
    // 5. Pull canonical server state (correct XP, distance, streaks from DB trigger)
    await pullProfile();
    // 6. Refresh run list
    await pullRuns();
    // 7. Pull the territory row process-run-territory just wrote server-side
    //    (the server is the sole claim path — see pullTerritories' doc comment)
    await pullTerritories();
    // 8. Sync any new nutrition entries logged during the run (XP food bonuses etc.)
    await pushNutritionLogs();
    setSyncStatus('idle');
    return { ok: true };
  } catch (err) {
    reportSyncError('postRunSync', err);
    // navigator.onLine is undefined in React Native (not just false) — only report
    // 'offline' when we positively know the device is offline, so real server/RLS
    // errors surface as 'error' instead of being masked as an unretriable "offline".
    setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
    // Don't attempt a pull on error — stale local state is safer than an overwritten local
    return { ok: false };
  }
}
