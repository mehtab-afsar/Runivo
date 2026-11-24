/**
 * Background location task for Runivo run tracking.
 *
 * IMPORTANT: This file MUST be imported at the top level of App.tsx (or any
 * file loaded at app startup) BEFORE expo-location starts a background task.
 * TaskManager.defineTask() registers the task name globally — React Navigation
 * and component trees are not yet mounted when this executes.
 *
 * Architecture:
 * - foreground: useActiveRun subscribes via watchPositionAsync
 * - background: this task fires via startLocationUpdatesAsync, writes to
 *   the bg_gps_buffer SQLite table; useActiveRun merges on resume.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GAME_CONFIG } from '@shared/services/config';

/** AsyncStorage key prefix of the in-run crash checkpoint (useActiveRun writes `<prefix><runId>`). */
export const GPS_CHECKPOINT_PREFIX = 'run_checkpoint_';

/** Sign-out: forget every unfinished-run trace on this phone, buffer and checkpoint alike. */
export async function wipeRunTrackingState(): Promise<void> {
  wipeBgGpsState();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(GPS_CHECKPOINT_PREFIX));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch { /* nothing to remove */ }
}

// ─── Task name ────────────────────────────────────────────────────────────────
export const BACKGROUND_LOCATION_TASK = 'runivo-background-location';

// ─── Background GPS buffer (written without going through store.native.ts) ───
// We open the same DB file — WAL mode allows concurrent readers/writers.
let _bgDb: SQLite.SQLiteDatabase | null = null;

function getBgDb(): SQLite.SQLiteDatabase {
  if (!_bgDb) {
    _bgDb = SQLite.openDatabaseSync('runivo.db');
    // Ensure bg buffer table exists (idempotent)
    _bgDb.execSync(`
      CREATE TABLE IF NOT EXISTS bg_gps_buffer (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id    TEXT NOT NULL,
        lat       REAL NOT NULL,
        lng       REAL NOT NULL,
        speed     REAL NOT NULL DEFAULT 0,
        accuracy  REAL NOT NULL DEFAULT 10,
        ts        INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bg_gps_run ON bg_gps_buffer(run_id, ts);
    `);
    // Added after launch builds: whether the fix came from a mock provider
    // (Android). Older installs have the table without it.
    try { _bgDb.execSync('ALTER TABLE bg_gps_buffer ADD COLUMN mocked INTEGER NOT NULL DEFAULT 0'); } catch { /* already there */ }
  }
  return _bgDb;
}

/** Write a single GPS point to the background buffer. */
export function appendBgGpsPoint(
  runId: string,
  lat: number,
  lng: number,
  speed: number,
  accuracy: number,
  ts: number,
  mocked = false,
): void {
  try {
    const db = getBgDb();
    db.runSync(
      `INSERT INTO bg_gps_buffer (run_id, lat, lng, speed, accuracy, ts, mocked) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [runId, lat, lng, speed, accuracy, Math.round(ts), mocked ? 1 : 0],
    );
  } catch (err) {
    console.warn('[locationTask] Failed to write bg GPS point:', err);
  }
}

/** Read all buffered points for a run, then clear them. */
export function drainBgGpsBuffer(runId: string): {
  lat: number; lng: number; speed: number; accuracy: number; timestamp: number; mocked: boolean;
}[] {
  try {
    const db = getBgDb();
    const rows = db.getAllSync<{
      lat: number; lng: number; speed: number; accuracy: number; ts: number; mocked: number | null;
    }>(
      `SELECT lat, lng, speed, accuracy, ts, mocked FROM bg_gps_buffer WHERE run_id = ? ORDER BY ts ASC`,
      [runId],
    );
    db.runSync(`DELETE FROM bg_gps_buffer WHERE run_id = ?`, [runId]);
    return rows.map(r => ({
      lat: r.lat, lng: r.lng,
      // iOS reports -1 for an unknown speed.
      speed: r.speed >= 0 ? r.speed : 0, accuracy: r.accuracy, timestamp: r.ts, mocked: r.mocked === 1,
    }));
  } catch (err) {
    console.warn('[locationTask] Failed to drain bg GPS buffer:', err);
    return [];
  }
}

/** How many fixes are buffered for a run (crash recovery: on Android they can be the whole run). */
export function countBgGpsBuffer(runId: string): number {
  try {
    return getBgDb().getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM bg_gps_buffer WHERE run_id = ?`, [runId])?.n ?? 0;
  } catch {
    return 0;
  }
}

/** The run the background task was recording, with its first buffered fix time, if any fixes are buffered. */
export function bufferedActiveRun(): { runId: string; firstTs: number; count: number } | null {
  try {
    const db = getBgDb();
    const row = db.getFirstSync<{ value: string }>(`SELECT value FROM bg_gps_meta WHERE key = 'active_run_id'`);
    if (!row?.value) return null;
    const agg = db.getFirstSync<{ n: number; t: number | null }>(
      `SELECT COUNT(*) AS n, MIN(ts) AS t FROM bg_gps_buffer WHERE run_id = ?`, [row.value],
    );
    if (!agg || agg.n === 0 || agg.t == null) return null;
    return { runId: row.value, firstTs: agg.t, count: agg.n };
  } catch {
    return null;
  }
}

/**
 * Drop every buffered fix and the active-run marker, whatever run they belong
 * to. For sign-out: a different account on this phone must not be offered the
 * previous runner's location trace.
 */
export function wipeBgGpsState(): void {
  try {
    const db = getBgDb();
    db.runSync('DELETE FROM bg_gps_buffer');
    // Created lazily by setActiveRunId, so it may not exist yet.
    try { db.runSync('DELETE FROM bg_gps_meta'); } catch { /* no such table */ }
  } catch { /* nothing buffered */ }
}

/** Clear the buffer for a run (called on run cancel). */
export function clearBgGpsBuffer(runId: string): void {
  try {
    getBgDb().runSync(`DELETE FROM bg_gps_buffer WHERE run_id = ?`, [runId]);
  } catch { /* silent */ }
}

// ─── Task definition ─────────────────────────────────────────────────────────
// TaskManager.defineTask must be called at module-load time (not in a hook).
// The task fires even when the JS thread is paused / app in background.

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations?: Location.LocationObject[] }>) => {
    if (error) {
      console.warn('[locationTask] background error:', error.message);
      return;
    }

    // This task fires for every location update regardless of app state — while the
    // app is foregrounded, useActiveRun's own watchPositionAsync subscription is
    // already recording every point directly into distance/gpsPoints. Without this
    // guard, the same fixes were ALSO buffered here and re-applied on the next
    // drainBgGpsBuffer() call (foreground→background→foreground, or at finish),
    // double-counting distance/pace/PACE for essentially every run. Only buffer
    // while the app isn't active — i.e. genuinely backgrounded/screen-off.
    if (AppState.currentState === 'active') return;

    const locations = data?.locations;
    if (!locations?.length) return;

    // Resolve the active run id ONLY from the sentinel set by setActiveRunId() before
    // tracking starts. The previous fallback (newest bg_gps_buffer row) was
    // self-perpetuating: once a run ended without a clean stopBackgroundTracking()
    // (crash/force-kill), the next run's points kept resolving back to the dead run's
    // id because its buffer rows were still the "newest" — silently losing all
    // background GPS for every run after an unclean shutdown.
    let activeRunId: string | null = null;
    try {
      const db = getBgDb();
      const row = db.getFirstSync<{ value: string }>(
        `SELECT value FROM bg_gps_meta WHERE key = 'active_run_id'`,
      );
      activeRunId = row?.value ?? null;
    } catch { /* table may not exist yet */ }

    if (!activeRunId) return;

    for (const loc of locations) {
      // Same accuracy gate the foreground watcher applies (useActiveRun.ts) — without
      // it, a signal-poor background stretch (pocket, tunnel) injects zigzag noise
      // straight into distance on exactly the path where GPS is least reliable.
      if ((loc.coords.accuracy ?? 100) > GAME_CONFIG.GPS_LIVE_ACCURACY_THRESHOLD_M) continue;
      appendBgGpsPoint(
        activeRunId,
        loc.coords.latitude,
        loc.coords.longitude,
        loc.coords.speed ?? 0,
        loc.coords.accuracy ?? 10,
        loc.timestamp,
        // Android flags fixes from a mock provider. With the screen off these
        // are the only fixes, so the flag has to travel with them.
        (loc as { mocked?: boolean }).mocked === true,
      );
    }
  },
);

// ─── Start / stop helpers (called from useActiveRun) ─────────────────────────

/** Call this BEFORE starting location updates so the task knows the run ID. */
export function setActiveRunId(runId: string): void {
  try {
    const db = getBgDb();
    db.execSync(`
      CREATE TABLE IF NOT EXISTS bg_gps_meta (key TEXT PRIMARY KEY, value TEXT);
    `);
    db.runSync(
      `INSERT OR REPLACE INTO bg_gps_meta (key, value) VALUES ('active_run_id', ?)`,
      [runId],
    );
  } catch (err) {
    console.warn('[locationTask] setActiveRunId failed:', err);
  }
}

export async function startBackgroundTracking(
  runId: string,
  accuracy: Location.Accuracy = Location.Accuracy.BestForNavigation,
): Promise<void> {
  // Persist the run ID so the task can look it up when it fires
  setActiveRunId(runId);

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) return; // already running

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy,
    timeInterval:            2000,   // 2-second floor between updates
    distanceInterval:        3,      // min 3 m between updates
    showsBackgroundLocationIndicator: true,   // blue iOS status bar
    pausesUpdatesAutomatically:       false,
    activityType:            Location.ActivityType.Fitness,
    foregroundService: {
      notificationTitle:   'Runivo is tracking your run',
      notificationBody:    'Running in the background…',
      notificationColor:   '#D93518',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopBackgroundTracking(): Promise<void> {
  try {
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[locationTask] stopBackgroundTracking error:', err);
  }
}

/**
 * Call once on app/RunScreen mount, before any run has been started or recovered.
 * A background task can be left registered if the app process was killed/crashed
 * mid-run (no chance to run the normal finish/cancel cleanup) — without this, the
 * orphaned task keeps writing GPS points under the dead run's id forever (battery
 * drain, persistent iOS location indicator) and, since bg_gps_meta still points at
 * that dead run, every subsequent real run's background points get misattributed to
 * it and are never drained. Caller passes whether a real run is about to resume
 * (actively running or a checkpoint is being recovered) — if not, any registered
 * task is definitionally orphaned.
 */
export async function cleanupOrphanedBackgroundTask(hasActiveOrRecoverableRun: boolean): Promise<void> {
  if (hasActiveOrRecoverableRun) return;
  try {
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) return;
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    const db = getBgDb();
    db.execSync('DELETE FROM bg_gps_buffer; DELETE FROM bg_gps_meta;');
  } catch (err) {
    console.warn('[locationTask] cleanupOrphanedBackgroundTask error:', err);
  }
}
