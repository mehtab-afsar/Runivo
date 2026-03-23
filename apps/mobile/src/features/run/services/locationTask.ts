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
): void {
  try {
    const db = getBgDb();
    db.runSync(
      `INSERT INTO bg_gps_buffer (run_id, lat, lng, speed, accuracy, ts) VALUES (?, ?, ?, ?, ?, ?)`,
      [runId, lat, lng, speed, accuracy, ts],
    );
  } catch (err) {
    console.warn('[locationTask] Failed to write bg GPS point:', err);
  }
}

/** Read all buffered points for a run, then clear them. */
export function drainBgGpsBuffer(runId: string): {
  lat: number; lng: number; speed: number; accuracy: number; timestamp: number;
}[] {
  try {
    const db = getBgDb();
    const rows = db.getAllSync<{
      lat: number; lng: number; speed: number; accuracy: number; ts: number;
    }>(
      `SELECT lat, lng, speed, accuracy, ts FROM bg_gps_buffer WHERE run_id = ? ORDER BY ts ASC`,
      [runId],
    );
    db.runSync(`DELETE FROM bg_gps_buffer WHERE run_id = ?`, [runId]);
    return rows.map(r => ({
      lat: r.lat, lng: r.lng,
      speed: r.speed, accuracy: r.accuracy, timestamp: r.ts,
    }));
  } catch (err) {
    console.warn('[locationTask] Failed to drain bg GPS buffer:', err);
    return [];
  }
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

    const locations = data?.locations;
    if (!locations?.length) return;

    // Read active run_id from bg_gps_buffer's most recent entry
    // (set by startBackgroundTracking before task starts)
    let activeRunId: string | null = null;
    try {
      const db = getBgDb();
      const row = db.getFirstSync<{ run_id: string }>(
        `SELECT run_id FROM bg_gps_buffer ORDER BY id DESC LIMIT 1`,
      );
      activeRunId = row?.run_id ?? null;
    } catch { /* ignore */ }

    if (!activeRunId) {
      // No active run — read from a sentinel row
      try {
        const db = getBgDb();
        const row = db.getFirstSync<{ run_id: string }>(
          `SELECT value FROM bg_gps_meta WHERE key = 'active_run_id'`,
        );
        activeRunId = (row as any)?.value ?? null;
      } catch { /* table may not exist yet */ }
    }

    if (!activeRunId) return;

    for (const loc of locations) {
      appendBgGpsPoint(
        activeRunId,
        loc.coords.latitude,
        loc.coords.longitude,
        loc.coords.speed ?? 0,
        loc.coords.accuracy ?? 10,
        loc.timestamp,
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

export async function startBackgroundTracking(runId: string): Promise<void> {
  // Persist the run ID so the task can look it up when it fires
  setActiveRunId(runId);

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) return; // already running

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy:                Location.Accuracy.BestForNavigation,
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
