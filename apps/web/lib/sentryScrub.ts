/**
 * Sentry beforeSend PII scrubber (web).
 *
 * Ported from apps/mobile/src/shared/services/sentryScrub.ts rather than shared —
 * small enough to duplicate, and keeps the mobile package free of a web-only
 * dependency edge. Strips GPS coordinates and auth tokens from error/breadcrumb
 * payloads before they leave the browser/server, by key-name/value-shape rather
 * than hand-enumerated call sites.
 */

const SENSITIVE_KEY_PATTERN =
  /^(lat|lng|latitude|longitude|coords?|gpsPoints?|lastKnownLocation|routePoints)$/i;

const WKT_POINT_PATTERN = /SRID=\d+;POINT\([^)]*\)/gi;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g;

const REDACTED = '[redacted]';

function scrubString(value: string): string {
  return value
    .replace(WKT_POINT_PATTERN, REDACTED)
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED);
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return REDACTED;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => scrubValue(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrubValue(val, seen);
  }
  return out;
}

/** Deep-scrubs GPS coordinates and auth tokens from a Sentry event before it's sent. */
export function scrubPII<T>(event: T): T {
  return scrubValue(event, new WeakSet()) as T;
}
