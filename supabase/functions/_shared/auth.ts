/**
 * Shared caller checks for edge functions that sit behind verify_jwt = false.
 *
 * Secrets are compared through a SHA-256 digest and node:crypto's
 * timingSafeEqual, so neither the content nor the length of the expected value
 * shows up in response timing (a plain `===` on the Authorization header does).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string equality. Safe for secrets of different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when the request carries `Authorization: Bearer <expected>`; false if `expected` is empty. */
export function hasBearer(req: Request, expected: string | undefined | null): boolean {
  if (!expected) return false;
  const header = req.headers.get('Authorization') ?? '';
  const m = /^Bearer (.+)$/.exec(header);
  return m !== null && safeEqual(m[1], expected);
}

/** True when the caller presented this project's service-role key (server-to-server only). */
export function isServiceRoleRequest(req: Request): boolean {
  return hasBearer(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
