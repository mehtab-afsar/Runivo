/**
 * Schema migrations for the on-device SQLite database (`runivo.db`).
 *
 * The schema version lives in SQLite's own `PRAGMA user_version` (an integer in the
 * database header). Every connection that opens `runivo.db` runs `migrateDatabase()`
 * first. That is four of them today: store.native, missionStore.native, profile.native
 * and the background-location task, which can wake the app before any screen has run.
 * So the runner has to be cheap, idempotent, and safe when two connections race.
 *
 * ── How a migration runs ────────────────────────────────────────────────────────
 *   BEGIN IMMEDIATE            take the write lock up front (a second connection waits
 *                              on busy_timeout instead of failing halfway through)
 *   re-read user_version       another connection may have migrated while we waited
 *   migration.up(db)           DDL; SQLite DDL is transactional
 *   PRAGMA user_version = N    also transactional, so it commits or rolls back with the DDL
 *   COMMIT                     (any error → ROLLBACK, version unchanged, error rethrown)
 *
 * ── Adding a schema change ──────────────────────────────────────────────────────
 * NEVER edit a migration that has shipped. Append the next number to MIGRATIONS:
 *
 *   {
 *     version: 2,
 *     name: 'runs-add-device-id',
 *     up: db => {
 *       ensureColumn(db, 'runs', 'device_id', 'TEXT');                  // idempotent ADD COLUMN
 *       db.execSync('CREATE INDEX IF NOT EXISTS idx_runs_device ON runs(device_id)');
 *       // new table:   db.execSync('CREATE TABLE IF NOT EXISTS foo (...)');
 *       // data fix:    db.execSync("UPDATE settings SET value = ... WHERE key = '...'");
 *     },
 *   },
 *
 * Rules:
 *   • Versions are 1, 2, 3, … with no gaps or repeats (checked on every start).
 *   • Write `up` so it is safe to re-run: IF NOT EXISTS, ensureColumn(), guarded UPDATEs.
 *   • Don't put PRAGMA journal_mode / foreign_keys in `up`: they're no-ops inside a
 *     transaction. Connection-level settings go in configureConnection().
 *   • Changing or dropping a column isn't a plain ALTER in SQLite: create a new table,
 *     copy rows over, drop the old one and rename, all inside the one `up`.
 *   • Add a test in localDbMigrations.test.ts that upgrades a database in the previous shape.
 *
 * A database whose user_version is HIGHER than this build knows (the user downgraded
 * the app) is left untouched and reported: migrations only add things, so an older
 * build keeps working on a newer schema. Refusing to start would lose them their runs.
 */

import { captureHandledError } from './errorReporting';

/** The subset of expo-sqlite's SQLiteDatabase the runner uses (synchronous API only). */
export interface MigrationDb {
  execSync(source: string): void;
  getFirstSync<T>(source: string): T | null;
  getAllSync<T>(source: string): T[];
}

export interface Migration {
  version: number;
  name: string;
  up: (db: MigrationDb) => void;
}

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  applied: number[];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdentifier(name: string): void {
  if (!IDENTIFIER.test(name)) throw new Error(`[localDb] invalid SQL identifier: ${name}`);
}

export function readUserVersion(db: MigrationDb): number {
  return db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

export function tableColumns(db: MigrationDb, table: string): string[] {
  assertIdentifier(table);
  return db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map(c => c.name);
}

/**
 * `ALTER TABLE … ADD COLUMN`, but only if the column isn't already there. Replaces the
 * old "run it and swallow the duplicate-column error" pattern. `definition` is the
 * column type and constraints, e.g. `'INTEGER NOT NULL DEFAULT 0'`. A constant from code, never user input.
 */
export function ensureColumn(db: MigrationDb, table: string, column: string, definition: string): boolean {
  assertIdentifier(column);
  if (tableColumns(db, table).includes(column)) return false;
  db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

// ─── v1: baseline ────────────────────────────────────────────────────────────

/**
 * Everything that used to be created ad hoc by store.native, missionStore.native,
 * profile.native and locationTask, plus the one legacy ALTER. Safe on three kinds of
 * database: brand new, a pre-versioned one (user_version 0 with tables already there,
 * i.e. every install before this file existed), and one half-created by an older build.
 */
function baseline(db: MigrationDb): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS runs (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      synced     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs(start_time);
    CREATE INDEX IF NOT EXISTS idx_runs_synced     ON runs(synced);

    CREATE TABLE IF NOT EXISTS player (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS territories (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_actions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT NOT NULL,
      territory_id TEXT NOT NULL,
      timestamp    INTEGER NOT NULL,
      gps_proof    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_routes (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_profile (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      date      TEXT NOT NULL,
      data      TEXT NOT NULL,
      logged_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_nutrition_date ON nutrition_log(date);

    CREATE TABLE IF NOT EXISTS shoes (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      data      TEXT NOT NULL,
      logged_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_weight_logs_logged_at ON weight_logs(logged_at);

    CREATE TABLE IF NOT EXISTS missions (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_missions_expires ON missions(expires_at);

    CREATE TABLE IF NOT EXISTS mission_runs (
      run_id     TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bg_gps_buffer (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id    TEXT NOT NULL,
      lat       REAL NOT NULL,
      lng       REAL NOT NULL,
      speed     REAL NOT NULL DEFAULT 0,
      accuracy  REAL NOT NULL DEFAULT 10,
      ts        INTEGER NOT NULL,
      mocked    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_bg_gps_run ON bg_gps_buffer(run_id, ts);

    CREATE TABLE IF NOT EXISTS bg_gps_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Legacy column. Installs from before the mock-location flag have bg_gps_buffer without it.
  ensureColumn(db, 'bg_gps_buffer', 'mocked', 'INTEGER NOT NULL DEFAULT 0');
}

/** Append-only. See the template at the top of this file. */
export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'baseline', up: baseline },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

// ─── Runner ──────────────────────────────────────────────────────────────────

function assertSequential(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`[localDb] migrations must be numbered 1..n in order; found v${m.version} at position ${i + 1}`);
    }
  });
}

/**
 * Connection-level settings. These are not part of a migration: busy_timeout and
 * foreign_keys apply per connection, and journal_mode can't change inside a transaction.
 */
function configureConnection(db: MigrationDb): void {
  db.execSync('PRAGMA busy_timeout = 5000');
  try {
    db.execSync('PRAGMA journal_mode = WAL');
  } catch (err) {
    // WAL is a performance setting. If it can't be switched right now (another
    // connection holds the file), carry on in the current mode.
    captureHandledError(err, { domain: 'storage', operation: 'enable-wal' });
  }
  db.execSync('PRAGMA foreign_keys = ON');
}

function applyMigration(db: MigrationDb, m: Migration): boolean {
  db.execSync('BEGIN IMMEDIATE');
  try {
    // Another connection may have applied this while we waited for the lock.
    if (readUserVersion(db) >= m.version) {
      db.execSync('ROLLBACK');
      return false;
    }
    m.up(db);
    db.execSync(`PRAGMA user_version = ${m.version}`);
    db.execSync('COMMIT');
    return true;
  } catch (err) {
    try {
      db.execSync('ROLLBACK');
    } catch {
      // SQLite already ended the transaction on its own (e.g. disk full), so there's nothing to roll back.
    }
    throw err;
  }
}

/** Highest schema version each connection has been verified at, so a connection is only checked once. */
const verifiedAt = new WeakMap<object, number>();

/**
 * Brings `db` up to the latest schema. Idempotent and cheap once verified: a connection
 * is only checked once per process. Throws (after reporting) if a migration fails, with
 * that migration rolled back.
 */
export function migrateDatabase(db: MigrationDb, migrations: readonly Migration[] = MIGRATIONS): MigrationResult {
  assertSequential(migrations);
  const latest = migrations.length ? migrations[migrations.length - 1]!.version : 0;

  const seen = verifiedAt.get(db);
  if (seen !== undefined && seen >= latest) {
    const v = readUserVersion(db);
    return { fromVersion: v, toVersion: v, applied: [] };
  }

  configureConnection(db);
  const fromVersion = readUserVersion(db);
  const applied: number[] = [];

  if (fromVersion > latest) {
    captureHandledError(new Error('local database is newer than this app build'), {
      domain: 'storage',
      operation: 'db-newer-than-app',
      extra: { dbVersion: fromVersion, appVersion: latest },
    });
    verifiedAt.set(db, latest);
    return { fromVersion, toVersion: fromVersion, applied };
  }

  try {
    for (const m of migrations) {
      if (m.version <= fromVersion) continue;
      if (applyMigration(db, m)) applied.push(m.version);
    }
  } catch (err) {
    captureHandledError(err, {
      domain: 'storage',
      operation: 'migrate',
      extra: { fromVersion, targetVersion: latest, applied: applied.length },
    });
    throw err;
  }

  verifiedAt.set(db, latest);
  return { fromVersion, toVersion: readUserVersion(db), applied };
}
