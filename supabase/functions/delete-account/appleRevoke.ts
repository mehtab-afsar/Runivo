// Pure helper (WebCrypto and fetch only, no Deno APIs) so vitest can cover it.
//
// App Store 5.1.1(v) / TN3194: when an account created with Sign in with Apple
// is deleted, the app must also revoke the Apple tokens, or the app stays
// listed under the user's Apple ID "Sign in with Apple" settings.
//
// The flow Apple documents:
//   1. Make a client secret: an ES256 JWT signed with the team's .p8 key.
//   2. Exchange the one-time authorizationCode (from a fresh Apple sign-in on
//      the phone) at /auth/token for a refresh token.
//   3. POST that refresh token to /auth/revoke.
// The code is single use and expires in minutes, so the phone re-authenticates
// at deletion time and sends the code with the delete request.

export interface AppleRevokeConfig {
  teamId: string;      // Apple Developer Team ID (the JWT `iss`)
  keyId: string;       // Key ID of the Sign in with Apple .p8 key (the JWT `kid`)
  privateKey: string;  // contents of the .p8 file (PKCS8 PEM)
  clientId: string;    // the app's bundle ID for native sign-in
}

const APPLE = 'https://appleid.apple.com';

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** The ES256 client secret Apple asks for. Valid 5 minutes: it is minted per request. */
export async function makeAppleClientSecret(cfg: AppleRevokeConfig, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = { alg: 'ES256', kid: cfg.keyId, typ: 'JWT' };
  const claims = { iss: cfg.teamId, iat: nowSec, exp: nowSec + 300, aud: APPLE, sub: cfg.clientId };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(cfg.privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  // WebCrypto returns the raw r||s form that JWS ES256 requires (not DER).
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/** Exchange the authorization code, then revoke the resulting refresh token. Returns true on success. */
export async function revokeAppleSignIn(
  cfg: AppleRevokeConfig,
  authorizationCode: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  const clientSecret = await makeAppleClientSecret(cfg);

  const tokenRes = await fetchFn(`${APPLE}/auth/token`, {
    method: 'POST', headers,
    body: form({ client_id: cfg.clientId, client_secret: clientSecret, code: authorizationCode, grant_type: 'authorization_code' }),
  });
  if (!tokenRes.ok) return false;
  const refreshToken = ((await tokenRes.json()) as { refresh_token?: string }).refresh_token;
  if (!refreshToken) return false;

  const revokeRes = await fetchFn(`${APPLE}/auth/revoke`, {
    method: 'POST', headers,
    body: form({ client_id: cfg.clientId, client_secret: clientSecret, token: refreshToken, token_type_hint: 'refresh_token' }),
  });
  return revokeRes.ok;
}

/** Read the four secrets; null when any is missing so the caller can skip cleanly. */
export function appleConfigFromEnv(get: (k: string) => string | undefined): AppleRevokeConfig | null {
  const teamId = get('APPLE_TEAM_ID');
  const keyId = get('APPLE_KEY_ID');
  const clientId = get('APPLE_CLIENT_ID');
  // Secrets are often stored with literal "\n" instead of newlines.
  const privateKey = get('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  return teamId && keyId && clientId && privateKey ? { teamId, keyId, clientId, privateKey } : null;
}
