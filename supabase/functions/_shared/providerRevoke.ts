/**
 * Cutting ties with outside providers when a runner leaves or disconnects.
 *
 * (Apple's token revoke on deletion lives in delete-account/appleRevoke.ts.)
 *
 * Garmin and Polar: deregistering stops the provider pushing the runner's
 * activities to our webhook after they have gone.
 *
 * Web Crypto only (no Deno or Node APIs), so vitest covers it too.
 */

const enc = new TextEncoder();

type Fetch = typeof fetch;

// ─── Garmin (OAuth 1.0a) ──────────────────────────────────────────────────────

const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function oauth1BaseString(method: string, url: string, params: Record<string, string>): string {
  const paramStr = Object.entries(params)
    .map(([k, v]) => [pct(k), pct(v)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('&');
  return `${method.toUpperCase()}&${pct(url)}&${pct(paramStr)}`;
}

export async function oauth1Signature(base: string, consumerSecret: string, tokenSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(`${pct(consumerSecret)}&${pct(tokenSecret)}`), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(base)));
  let s = '';
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s);
}

export const GARMIN_REGISTRATION_URL = 'https://apis.garmin.com/wellness-api/rest/user/registration';

/** Deregister the runner at Garmin so it stops pushing their activities. */
export async function deregisterGarmin(
  consumer: { key: string; secret: string },
  token: { accessToken: string; tokenSecret: string },
  fetchImpl: Fetch = fetch,
): Promise<string | null> {
  const params: Record<string, string> = {
    oauth_consumer_key: consumer.key,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token.accessToken,
    oauth_version: '1.0',
  };
  params.oauth_signature = await oauth1Signature(
    oauth1BaseString('DELETE', GARMIN_REGISTRATION_URL, params), consumer.secret, token.tokenSecret,
  );
  const header = 'OAuth ' + Object.entries(params).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
  const res = await fetchImpl(GARMIN_REGISTRATION_URL, { method: 'DELETE', headers: { Authorization: header } });
  // 204 on success; 404/401 means Garmin no longer knows this token, which is the goal anyway.
  return res.ok || res.status === 404 || res.status === 401 ? null : `garmin_${res.status}`;
}

// ─── Polar (AccessLink) ───────────────────────────────────────────────────────

/** Delete the runner's AccessLink registration so Polar stops sending data. */
export async function deregisterPolar(accessToken: string, polarUserId: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const res = await fetchImpl(`https://www.polaraccesslink.com/v3/users/${encodeURIComponent(polarUserId)}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok || res.status === 404 || res.status === 401 ? null : `polar_${res.status}`;
}

// ─── One place to cut every connection a runner has ──────────────────────────

export interface ConnectionRow {
  device_type: string;
  secrets: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
}

/** Best-effort: deregister every connected provider. Returns the failures, for logs. */
export async function deregisterConnections(
  rows: ConnectionRow[],
  env: (name: string) => string | undefined,
  fetchImpl: Fetch = fetch,
): Promise<string[]> {
  const failures: string[] = [];
  for (const r of rows) {
    const s = r.secrets ?? {};
    try {
      if (r.device_type === 'garmin' && s.access_token && s.token_secret) {
        const why = await deregisterGarmin(
          { key: env('GARMIN_CONSUMER_KEY') ?? '', secret: env('GARMIN_CONSUMER_SECRET') ?? '' },
          { accessToken: s.access_token, tokenSecret: s.token_secret }, fetchImpl,
        );
        if (why) failures.push(why);
      } else if (r.device_type === 'polar' && s.access_token) {
        const polarId = String(r.metadata?.provider_user_id ?? s.x_user_id ?? '');
        if (polarId) {
          const why = await deregisterPolar(s.access_token, polarId, fetchImpl);
          if (why) failures.push(why);
        }
      }
      // COROS has no public deauthorise endpoint; dropping the token is all we can do.
    } catch (err) {
      failures.push(`${r.device_type}_error:${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failures;
}
