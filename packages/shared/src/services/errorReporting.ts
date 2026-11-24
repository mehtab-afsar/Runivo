/**
 * Handled-error reporting.
 *
 * For `catch` blocks that recover (return a fallback, retry on the next tick) but
 * whose failure is NOT expected: a SQLite read/write, a sync-queue push, a dropped
 * GPS fix, a HealthKit/Location bridge call, a checkpoint write. Swallowing those
 * silently is how a run quietly goes missing, so they go through here instead.
 *
 * Expected, benign fallbacks (offline, "no such key", optional native module absent,
 * JSON.parse of optional input) must NOT be routed here: keep them as a bare `catch {}`
 * with a one-line comment saying why ignoring is safe.
 * Reporting them would bury the real signal under noise.
 *
 * Behaviour:
 *  - `__DEV__`: `console.warn` only. Nothing leaves the device.
 *  - production: hands the error to the reporter registered with `setErrorReporter`
 *    (apps/mobile registers Sentry in `initSentry`). With no reporter, it is a no-op.
 *  - never throws, whatever the reporter does. A reporting failure must not turn a
 *    recovered error into a crash inside a run-recording path.
 *  - throttled per domain+operation+message, so a per-GPS-fix failure doesn't send
 *    thousands of events.
 *
 * Privacy: `extra` is reduced to flat primitives before anything is logged or sent.
 * Arrays and objects (GPS point lists, rows, request bodies) are replaced by a size
 * marker, values under coordinate/token-like keys are redacted, and strings are scrubbed
 * of WKT points, bearer tokens and JWTs. Callers should still pass counts and ids
 * rather than payloads.
 *
 * This lives in packages/shared and has no Sentry import on purpose: shared code also
 * runs on web and in tests, and `@sentry/react-native` is a mobile-only dependency.
 */

export type ErrorDomain =
  | 'storage'     // local SQLite / AsyncStorage / IndexedDB
  | 'sync'        // pushing or pulling data to the server
  | 'run'         // run lifecycle: start, finish, save
  | 'gps'         // location fixes, background buffer
  | 'checkpoint'  // crash-recovery checkpoint
  | 'health'      // HealthKit / Health Connect
  | 'purchase'    // RevenueCat
  | 'push'        // push notification registration
  | 'auth'        // session / identity lookups
  | 'native';     // any other native bridge

export interface HandledErrorContext {
  domain: ErrorDomain;
  /** Short, stable, kebab-case name of what was being attempted, e.g. `'checkpoint-write'`. */
  operation: string;
  /** Flat, non-sensitive diagnostics (counts, ids, flags). Reduced to primitives before use. */
  extra?: Record<string, unknown>;
}

export type SafeExtra = Record<string, string | number | boolean | null>;

export interface HandledErrorReport {
  tags: { domain: ErrorDomain; operation: string; handled: 'true' };
  extra: SafeExtra;
}

export type ErrorReporter = (error: unknown, report: HandledErrorReport) => void;

let reporter: ErrorReporter | null = null;

/** Registers the production sink (Sentry). Pass `null` to unregister. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

// ─── Sanitising ──────────────────────────────────────────────────────────────

const SENSITIVE_KEY =
  /^(lat|lng|lon|latitude|longitude|coords?|gps\w*|points?|route\w*|lastKnownLocation|location|position|password|pass|secret|token|\w*token|authorization|auth|cookie|session|jwt|apikey|api_key|email|phone)$/i;
const WKT_POINT = /SRID=\d+;POINT\([^)]*\)/gi;
const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT = /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g;
const MAX_STRING = 200;
const MAX_KEYS = 20;
const REDACTED = '[redacted]';

function scrubString(value: string): string {
  const scrubbed = value
    .replace(WKT_POINT, REDACTED)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(JWT, REDACTED);
  return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…` : scrubbed;
}

/** Reduces arbitrary `extra` to flat primitives that are safe to log or send. */
export function sanitizeExtra(extra: Record<string, unknown> | undefined): SafeExtra {
  const out: SafeExtra = {};
  if (!extra) return out;
  for (const key of Object.keys(extra).slice(0, MAX_KEYS)) {
    const value = extra[key];
    if (SENSITIVE_KEY.test(key)) out[key] = REDACTED;
    else if (value === null || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : String(value);
    else if (typeof value === 'string') out[key] = scrubString(value);
    else if (Array.isArray(value)) out[key] = `[array(${value.length})]`;
    else if (value === undefined) continue;
    else out[key] = `[${typeof value}]`;
  }
  return out;
}

// ─── Throttle ────────────────────────────────────────────────────────────────

/** One report per identical failure per window; the rest are counted, not sent. */
export const REPORT_THROTTLE_MS = 60_000;
const MAX_TRACKED = 100;
const lastReported = new Map<string, { at: number; suppressed: number }>();

function throttleKey(error: unknown, ctx: HandledErrorContext): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${ctx.domain}|${ctx.operation}|${message.slice(0, 120)}`;
}

/** Test hook. */
export function __resetErrorReportingForTests(): void {
  reporter = null;
  lastReported.clear();
}

// ─── Public API ──────────────────────────────────────────────────────────────

function isDev(): boolean {
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

/**
 * Records an error a `catch` block has handled and moved on from. Safe to call from
 * any catch block: it never throws and never awaits.
 */
export function captureHandledError(error: unknown, ctx: HandledErrorContext): void {
  try {
    const extra = sanitizeExtra(ctx.extra);

    if (isDev()) {
      console.warn(`[${ctx.domain}] ${ctx.operation} failed:`, error, extra);
      return;
    }
    if (!reporter) return;

    const key = throttleKey(error, ctx);
    const now = Date.now();
    const prev = lastReported.get(key);
    if (prev && now - prev.at < REPORT_THROTTLE_MS) {
      prev.suppressed += 1;
      return;
    }
    if (prev && prev.suppressed > 0) extra.suppressedSinceLastReport = prev.suppressed;
    if (lastReported.size >= MAX_TRACKED) lastReported.clear();
    lastReported.set(key, { at: now, suppressed: 0 });

    reporter(error, { tags: { domain: ctx.domain, operation: ctx.operation, handled: 'true' }, extra });
  } catch {
    // Reporting is best-effort by definition. If it throws, the caller's recovery path
    // must still run, and there is nothing further to report the failure to.
  }
}
