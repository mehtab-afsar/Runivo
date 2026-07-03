/**
 * Sentry beforeSend PII scrubber.
 *
 * Runivo's error/breadcrumb payloads can carry GPS coordinates (raw lat/lng from
 * useActiveRun.ts, claimEngine.ts, and the lastKnownLocation WKT string built in
 * sync.ts) and auth tokens (Authorization headers, Supabase JWTs). None of that may
 * leave the device. This walks the whole event generically by key-name/value-shape
 * rather than hand-enumerating call sites, so newly-added GPS-bearing context is
 * covered without having to remember to update this file.
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
