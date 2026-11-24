/**
 * The sync plumbing every other sync module shares:
 *  - sync status (idle / syncing / error / offline) and its subscribers,
 *  - retry with exponential backoff,
 *  - a reporting hook for failures the sync deliberately recovers from.
 *
 * There is no separate queue table: what still has to go up is derived from the local
 * rows themselves (a run's `synced` / `serverProcessed` flags, a route's `synced`), and
 * each push reads those flags, so a crash mid-sync simply resumes next time.
 */

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

let _syncStatus: SyncStatus = 'idle';

// One entry object per subscription, not the bare function. The same function registered
// twice (two components sharing a handler) stays two independent subscriptions, and an
// unsubscribe can only ever remove its own entry: it used to `splice(indexOf(fn), 1)`, and
// a second call found indexOf === -1, which spliced out the LAST listener (someone else's).
const _statusListeners = new Set<{ fn: (s: SyncStatus) => void }>();

export function getSyncStatus(): SyncStatus { return _syncStatus; }

/** Subscribes to status changes. The returned unsubscribe is safe to call any number of times. */
export function onSyncStatusChange(fn: (s: SyncStatus) => void): () => void {
  const entry = { fn };
  _statusListeners.add(entry);
  return () => { _statusListeners.delete(entry); };
}

export function setSyncStatus(s: SyncStatus): void {
  _syncStatus = s;
  // Snapshot: a listener may unsubscribe (or subscribe) while being notified.
  [..._statusListeners].forEach(({ fn }) => fn(s));
}

/**
 * Runs `fn`, retrying on failure with 1 s, 2 s, … between attempts. `attempts` is the
 * total number of tries (default 3); the last failure is thrown.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise<void>(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('withRetry: unreachable');
}

// ── Reporting recovered failures ─────────────────────────────────────────────

export interface SyncErrorReport {
  /** Which step failed, e.g. 'scoreRun' or 'milestone'. */
  scope: string;
  error: unknown;
  /** Flat ids/counts only (a run id, not a GPS trace). */
  context?: Record<string, string | number | boolean>;
}

type SyncErrorListener = (report: SyncErrorReport) => void;

let _errorListener: SyncErrorListener | null = null;

/** Lets the app route recovered sync failures to its error tracker (default: console.warn). */
export function setSyncErrorListener(fn: SyncErrorListener | null): void { _errorListener = fn; }

/**
 * Report a failure the sync recovers from (a retry on the next sync, a non-critical
 * follow-up). These used to be swallowed in silent `catch {}` blocks, which is how a
 * scoring or debrief problem could go unnoticed for weeks. Never throws.
 */
export function reportSyncError(scope: string, error: unknown, context?: SyncErrorReport['context']): void {
  try {
    if (_errorListener) _errorListener({ scope, error, context });
    else console.warn(`[sync] ${scope} failed:`, error instanceof Error ? error.message : error, context ?? '');
  } catch { /* reporting must never break a sync */ }
}
