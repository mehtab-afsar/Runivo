import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { appleConfigFromEnv, makeAppleClientSecret, revokeAppleSignIn, type FetchLike } from './appleRevoke';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const cfg = { teamId: 'TEAM123456', keyId: 'KEY1234567', clientId: 'com.example.app', privateKey: pem };

const b64urlDecode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

describe('makeAppleClientSecret', () => {
  it('is an ES256 JWT with the claims Apple requires, signed by our key', async () => {
    const jwt = await makeAppleClientSecret(cfg, 1_800_000_000);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(b64urlDecode(h).toString())).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' });
    expect(JSON.parse(b64urlDecode(c).toString())).toEqual({
      iss: 'TEAM123456', iat: 1_800_000_000, exp: 1_800_000_300, aud: 'https://appleid.apple.com', sub: 'com.example.app',
    });
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, b64urlDecode(sig));
    expect(ok).toBe(true);
  });
});

describe('revokeAppleSignIn', () => {
  const recorder = (tokenOk = true, revokeOk = true) => {
    const calls: { url: string; body: URLSearchParams }[] = [];
    const fetchFn: FetchLike = async (url, init) => {
      calls.push({ url, body: new URLSearchParams(init.body) });
      if (url.endsWith('/auth/token')) return { ok: tokenOk, status: tokenOk ? 200 : 400, json: async () => ({ refresh_token: 'rt-1' }), text: async () => '' };
      return { ok: revokeOk, status: revokeOk ? 200 : 400, json: async () => ({}), text: async () => '' };
    };
    return { calls, fetchFn };
  };

  it('exchanges the code, then revokes the refresh token it got back', async () => {
    const { calls, fetchFn } = recorder();
    expect(await revokeAppleSignIn(cfg, 'one-time-code', fetchFn)).toBe(true);
    expect(calls.map(c => c.url)).toEqual(['https://appleid.apple.com/auth/token', 'https://appleid.apple.com/auth/revoke']);
    expect(calls[0].body.get('code')).toBe('one-time-code');
    expect(calls[0].body.get('grant_type')).toBe('authorization_code');
    expect(calls[1].body.get('token')).toBe('rt-1');
    expect(calls[1].body.get('token_type_hint')).toBe('refresh_token');
    expect(calls[1].body.get('client_id')).toBe('com.example.app');
  });

  it('reports failure, and does not call revoke, when the exchange fails', async () => {
    const { calls, fetchFn } = recorder(false);
    expect(await revokeAppleSignIn(cfg, 'bad', fetchFn)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('reports failure when revoke itself is rejected', async () => {
    expect(await revokeAppleSignIn(cfg, 'code', recorder(true, false).fetchFn)).toBe(false);
  });
});

describe('appleConfigFromEnv', () => {
  it('returns null unless all four secrets are set, and restores escaped newlines', () => {
    const env: Record<string, string> = { APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k', APPLE_CLIENT_ID: 'c' };
    expect(appleConfigFromEnv(k => env[k])).toBeNull();
    env.APPLE_PRIVATE_KEY = 'a\\nb';
    expect(appleConfigFromEnv(k => env[k])?.privateKey).toBe('a\nb');
  });
});
