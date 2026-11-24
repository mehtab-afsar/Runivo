import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  migrateDatabase,
  ensureColumn,
  readUserVersion,
  tableColumns,
  MIGRATIONS,
  LATEST_SCHEMA_VERSION,
  type Migration,
  type MigrationDb,
} from './localDbMigrations';
import { setErrorReporter, __resetErrorReportingForTests } from './errorReporting';

beforeEach(() => __resetErrorReportingForTests());

// ─────────────────────────────────────────────────────────────────────────────
// Real SQLite. node:sqlite ships with Node ≥ 22.5. CI pins Node 20 (.nvmrc), where
// this whole block is skipped; the scripted-fake suite below still runs there.
// ─────────────────────────────────────────────────────────────────────────────

interface NodeStatement { get(): unknown; all(): unknown[]; run(...p: unknown[]): unknown }
interface NodeDb { exec(sql: string): void; prepare(sql: string): NodeStatement; close(): void }
type NodeDbCtor = new (location: string) => NodeDb;

function loadNodeSqlite(): NodeDbCtor | null {
  try {
    // createRequire, not import(): Vite's loader strips the `node:` prefix, and `sqlite`
    // only exists as `node:sqlite`.
    const require = createRequire(import.meta.url);
    return (require('node:sqlite') as { DatabaseSync: NodeDbCtor }).DatabaseSync;
  } catch {
    return null; // Node < 22.5: the real-engine suite is skipped
  }
}
const DatabaseSync = loadNodeSqlite();

class RealDb implements MigrationDb {
  constructor(readonly raw: NodeDb) {}
  execSync(sql: string) { this.raw.exec(sql); }
  getFirstSync<T>(sql: string): T | null { return (this.raw.prepare(sql).get() as T | undefined) ?? null; }
  getAllSync<T>(sql: string): T[] { return this.raw.prepare(sql).all() as T[]; }
  tables(): string[] {
    return this.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .map(r => r.name).sort();
  }
}

const EXPECTED_TABLES = [
  'bg_gps_buffer', 'bg_gps_meta', 'mission_runs', 'missions', 'nutrition_log', 'nutrition_profile',
  'pending_actions', 'player', 'runs', 'saved_routes', 'settings', 'shoes', 'territories', 'weight_logs',
].sort();

/** The schema as every pre-versioned install has it: user_version 0, bg_gps_buffer without `mocked`. */
const LEGACY_SCHEMA = `
  CREATE TABLE runs (id TEXT PRIMARY KEY, data TEXT NOT NULL, start_time INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX idx_runs_start_time ON runs(start_time);
  CREATE TABLE player (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE missions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE bg_gps_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    speed REAL NOT NULL DEFAULT 0, accuracy REAL NOT NULL DEFAULT 10, ts INTEGER NOT NULL
  );
`;

describe.skipIf(!DatabaseSync)('migrateDatabase — real SQLite', () => {
  let dir: string;
  const open: NodeDb[] = [];
  const newDb = (file = ':memory:') => {
    const raw = new DatabaseSync!(file);
    open.push(raw);
    return new RealDb(raw);
  };

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runivo-db-test-')); });
  afterEach(() => {
    while (open.length) { try { open.pop()!.close(); } catch { /* already closed */ } }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fresh database: user_version goes 0 → 1 and every table and column exists', () => {
    const db = newDb();
    expect(readUserVersion(db)).toBe(0);

    const result = migrateDatabase(db);

    expect(result).toEqual({ fromVersion: 0, toVersion: 1, applied: [1] });
    expect(readUserVersion(db)).toBe(1);
    expect(LATEST_SCHEMA_VERSION).toBe(1);
    expect(db.tables()).toEqual(EXPECTED_TABLES);
    expect(tableColumns(db, 'bg_gps_buffer')).toEqual(['id', 'run_id', 'lat', 'lng', 'speed', 'accuracy', 'ts', 'mocked']);
    expect(tableColumns(db, 'runs')).toEqual(['id', 'data', 'start_time', 'synced']);
    expect(tableColumns(db, 'missions')).toEqual(['id', 'data', 'expires_at']);
    expect(tableColumns(db, 'bg_gps_meta')).toEqual(['key', 'value']);
  });

  it('is idempotent: a second run on a new connection changes nothing', () => {
    const file = path.join(dir, 'runivo.db');
    const a = newDb(file);
    migrateDatabase(a);
    a.raw.prepare("INSERT INTO settings (key, value) VALUES ('k', 'v')").run();

    const b = newDb(file);
    const result = migrateDatabase(b);

    expect(result).toEqual({ fromVersion: 1, toVersion: 1, applied: [] });
    expect(b.getFirstSync<{ value: string }>("SELECT value FROM settings WHERE key = 'k'")?.value).toBe('v');
  });

  it('upgrades a pre-versioned database (user_version 0, tables present) without losing data', () => {
    const file = path.join(dir, 'runivo.db');
    const db = newDb(file);
    db.execSync(LEGACY_SCHEMA);
    db.raw.prepare("INSERT INTO runs (id, data, start_time, synced) VALUES ('r1', '{\"d\":5000}', 1700000000000, 1)").run();
    db.raw.prepare("INSERT INTO player (id, data) VALUES ('p1', '{\"username\":\"sam\"}')").run();
    db.raw.prepare("INSERT INTO settings (key, value) VALUES ('player_profile', '{}')").run();
    db.raw.prepare('INSERT INTO bg_gps_buffer (run_id, lat, lng, speed, accuracy, ts) VALUES (?, ?, ?, ?, ?, ?)')
      .run('r1', 51.5, -0.12, 3.1, 8, 1700000001000);
    expect(readUserVersion(db)).toBe(0);
    expect(tableColumns(db, 'bg_gps_buffer')).not.toContain('mocked');

    expect(() => migrateDatabase(db)).not.toThrow();

    expect(readUserVersion(db)).toBe(1);
    expect(db.tables()).toEqual(EXPECTED_TABLES);
    // rows survive, byte for byte
    expect(db.getFirstSync<{ data: string; synced: number }>("SELECT data, synced FROM runs WHERE id = 'r1'"))
      .toMatchObject({ data: '{"d":5000}', synced: 1 });
    expect(db.getFirstSync<{ data: string }>("SELECT data FROM player WHERE id = 'p1'")?.data).toBe('{"username":"sam"}');
    expect(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM settings')?.n).toBe(1);
    // the legacy ALTER ran once; the old buffered fix defaults to "not mocked"
    expect(tableColumns(db, 'bg_gps_buffer').filter(c => c === 'mocked')).toHaveLength(1);
    expect(db.getFirstSync<{ lat: number; mocked: number }>('SELECT lat, mocked FROM bg_gps_buffer')).toMatchObject({ lat: 51.5, mocked: 0 });
  });

  it('upgrades a database an older build already ALTERed (column present, version 0): no duplicate-column error', () => {
    const db = newDb();
    db.execSync(LEGACY_SCHEMA);
    db.execSync('ALTER TABLE bg_gps_buffer ADD COLUMN mocked INTEGER NOT NULL DEFAULT 0');
    db.raw.prepare('INSERT INTO bg_gps_buffer (run_id, lat, lng, ts, mocked) VALUES (?, ?, ?, ?, ?)').run('r', 1, 2, 3, 1);

    expect(() => migrateDatabase(db)).not.toThrow();

    expect(db.getFirstSync<{ mocked: number }>('SELECT mocked FROM bg_gps_buffer')?.mocked).toBe(1);
    expect(readUserVersion(db)).toBe(1);
  });

  it('enables WAL on a file database', () => {
    const db = newDb(path.join(dir, 'runivo.db'));
    migrateDatabase(db);
    expect(db.getFirstSync<{ journal_mode: string }>('PRAGMA journal_mode')?.journal_mode).toBe('wal');
  });

  it('applies only the migrations newer than the database (v1 → v2)', () => {
    const db = newDb();
    migrateDatabase(db);
    const v2: Migration = {
      version: 2, name: 'runs-add-device',
      up: d => { ensureColumn(d, 'runs', 'device_id', 'TEXT'); },
    };

    const result = migrateDatabase(db, [...MIGRATIONS, v2]);

    expect(result).toEqual({ fromVersion: 1, toVersion: 2, applied: [2] });
    expect(tableColumns(db, 'runs')).toContain('device_id');
  });

  it('rolls a failed migration back completely and rethrows (version and DDL unchanged)', () => {
    const reported: string[] = [];
    setErrorReporter((_e, r) => reported.push(r.tags.operation));
    const bad: Migration = {
      version: 2, name: 'half-done',
      up: d => {
        d.execSync('CREATE TABLE half_done (id INTEGER)');
        d.execSync('INSERT INTO nope VALUES (1)'); // no such table → throws
      },
    };
    // A second connection to the same file, as in the app (store / mission / background task).
    const file = path.join(dir, 'rollback.db');
    const a = newDb(file);
    migrateDatabase(a);
    const b = newDb(file);

    expect(() => migrateDatabase(b, [...MIGRATIONS, bad])).toThrow(/no such table/);

    expect(readUserVersion(b)).toBe(1);
    expect(b.tables()).not.toContain('half_done');
    expect(reported).toEqual(['migrate']);
    // and the connection is usable again (the transaction was closed)
    expect(() => b.execSync('CREATE TABLE after_failure (id INTEGER)')).not.toThrow();
  });

  it('leaves a database that is newer than the app untouched', () => {
    const db = newDb();
    db.execSync('PRAGMA user_version = 7');
    db.execSync('CREATE TABLE future_table (id INTEGER)');

    const result = migrateDatabase(db);

    expect(result).toEqual({ fromVersion: 7, toVersion: 7, applied: [] });
    expect(readUserVersion(db)).toBe(7);
    expect(db.tables()).toEqual(['future_table']);
  });

  it('ensureColumn adds once, then reports the column already exists', () => {
    const db = newDb();
    db.execSync('CREATE TABLE t (id INTEGER)');
    expect(ensureColumn(db, 't', 'extra', 'TEXT')).toBe(true);
    expect(ensureColumn(db, 't', 'extra', 'TEXT')).toBe(false);
    expect(tableColumns(db, 't')).toEqual(['id', 'extra']);
  });

  it('ensureColumn rejects identifiers that are not plain names', () => {
    const db = newDb();
    expect(() => ensureColumn(db, 'runs; DROP TABLE runs', 'x', 'TEXT')).toThrow(/invalid SQL identifier/);
    expect(() => ensureColumn(db, 'runs', 'x INTEGER); --', 'TEXT')).toThrow(/invalid SQL identifier/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scripted fake: pins the transaction protocol without needing a SQL engine, so it
// also runs on Node 20.
// ─────────────────────────────────────────────────────────────────────────────

class FakeDb implements MigrationDb {
  log: string[] = [];
  version: number;
  private committed: number;
  /** Simulates another connection bumping the version while we wait for the write lock. */
  versionAfterBegin: number | null = null;
  failOn: string | null = null;

  constructor(version = 0) { this.version = version; this.committed = version; }

  execSync(sql: string): void {
    const s = sql.trim();
    this.log.push(s);
    if (this.failOn && s.includes(this.failOn)) throw new Error(`boom: ${this.failOn}`);
    if (s === 'BEGIN IMMEDIATE' && this.versionAfterBegin !== null) { this.version = this.committed = this.versionAfterBegin; }
    const set = /^PRAGMA user_version = (\d+)$/.exec(s);
    if (set) this.version = Number(set[1]);
    if (s === 'COMMIT') this.committed = this.version;
    if (s === 'ROLLBACK') this.version = this.committed;
  }
  getFirstSync<T>(sql: string): T | null {
    return sql === 'PRAGMA user_version' ? ({ user_version: this.version } as unknown as T) : null;
  }
  getAllSync<T>(): T[] { return []; }
}

const step = (version: number, onUp: (db: MigrationDb) => void = () => {}): Migration => ({ version, name: `m${version}`, up: onUp });
const txnLog = (db: FakeDb) => db.log.filter(s => /^(BEGIN|COMMIT|ROLLBACK|PRAGMA user_version =)/.test(s));

describe('migrateDatabase — transaction protocol', () => {
  it('wraps each step in BEGIN IMMEDIATE … PRAGMA user_version … COMMIT, in order', () => {
    const db = new FakeDb(0);
    const ran: number[] = [];
    const result = migrateDatabase(db, [step(1, () => ran.push(1)), step(2, () => ran.push(2))]);

    expect(ran).toEqual([1, 2]);
    expect(result).toEqual({ fromVersion: 0, toVersion: 2, applied: [1, 2] });
    expect(txnLog(db)).toEqual([
      'BEGIN IMMEDIATE', 'PRAGMA user_version = 1', 'COMMIT',
      'BEGIN IMMEDIATE', 'PRAGMA user_version = 2', 'COMMIT',
    ]);
  });

  it('sets connection pragmas outside any transaction', () => {
    const db = new FakeDb(0);
    migrateDatabase(db, [step(1)]);
    const begin = db.log.indexOf('BEGIN IMMEDIATE');
    expect(db.log.indexOf('PRAGMA busy_timeout = 5000')).toBeLessThan(begin);
    expect(db.log.indexOf('PRAGMA journal_mode = WAL')).toBeLessThan(begin);
    expect(db.log.indexOf('PRAGMA foreign_keys = ON')).toBeLessThan(begin);
  });

  it('skips steps at or below the current version and opens no transaction when up to date', () => {
    const db = new FakeDb(2);
    const ran: number[] = [];
    const result = migrateDatabase(db, [step(1, () => ran.push(1)), step(2, () => ran.push(2))]);
    expect(ran).toEqual([]);
    expect(result.applied).toEqual([]);
    expect(txnLog(db)).toEqual([]);
  });

  it('rolls back, keeps the old version and rethrows when a step fails', () => {
    const db = new FakeDb(0);
    const failing = step(2, d => d.execSync('CREATE TABLE explode (id INTEGER)'));
    db.failOn = 'CREATE TABLE explode';

    expect(() => migrateDatabase(db, [step(1), failing])).toThrow('boom: CREATE TABLE explode');

    expect(db.version).toBe(1);
    expect(txnLog(db)).toEqual([
      'BEGIN IMMEDIATE', 'PRAGMA user_version = 1', 'COMMIT',
      'BEGIN IMMEDIATE', 'ROLLBACK',
    ]);
  });

  it('still rethrows the original error if ROLLBACK itself fails', () => {
    const db = new FakeDb(0);
    db.failOn = 'ROLLBACK';
    expect(() => migrateDatabase(db, [step(1, () => { throw new Error('original'); })])).toThrow('original');
  });

  it('does not run a step another connection applied while we waited for the lock', () => {
    const db = new FakeDb(0);
    db.versionAfterBegin = 1;
    const ran: number[] = [];

    const result = migrateDatabase(db, [step(1, () => ran.push(1))]);

    expect(ran).toEqual([]);
    expect(result.applied).toEqual([]);
    expect(txnLog(db)).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
  });

  it('refuses migrations that are not numbered 1..n', () => {
    expect(() => migrateDatabase(new FakeDb(0), [step(1), step(3)])).toThrow(/numbered 1\.\.n/);
    expect(() => migrateDatabase(new FakeDb(0), [step(2)])).toThrow(/numbered 1\.\.n/);
    expect(() => migrateDatabase(new FakeDb(0), [step(1), step(1)])).toThrow(/numbered 1\.\.n/);
  });

  it('checks a connection once: later calls do no work', () => {
    const db = new FakeDb(0);
    migrateDatabase(db, [step(1)]);
    const callsAfterFirst = db.log.length;
    migrateDatabase(db, [step(1)]);
    expect(db.log.length).toBe(callsAfterFirst);
  });

  it('keeps going if WAL cannot be enabled (reports it, does not throw)', () => {
    const db = new FakeDb(0);
    const ops: string[] = [];
    setErrorReporter((_e, r) => ops.push(r.tags.operation));
    db.failOn = 'journal_mode';
    expect(() => migrateDatabase(db, [step(1)])).not.toThrow();
    expect(ops).toEqual(['enable-wal']);
    expect(db.version).toBe(1);
  });
});
