import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  oauth1BaseString, oauth1Signature,
  deregisterConnections, GARMIN_REGISTRATION_URL,
} from './providerRevoke';

type Call = { url: string; init?: RequestInit };
function fakeFetch(responses: Record<string, { status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses[url] ?? { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('OAuth 1.0a signing (Garmin)', () => {
  it('sorts and percent-encodes parameters per RFC 5849', () => {
    expect(oauth1BaseString('delete', 'https://x.test/a b', { b: '2', a: 'x y!', c: '' }))
      .toBe('DELETE&https%3A%2F%2Fx.test%2Fa%20b&a%3Dx%2520y%2521%26b%3D2%26c%3D');
  });

  it('signs with HMAC-SHA1 over consumer&token secret', async () => {
    const base = oauth1BaseString('DELETE', GARMIN_REGISTRATION_URL, { oauth_token: 't' });
    const expected = createHmac('sha1', 'cs&ts').update(base).digest('base64');
    expect(await oauth1Signature(base, 'cs', 'ts')).toBe(expected);
  });
});

describe('Deregistering watch connections', () => {
  const env = (n: string) => ({ GARMIN_CONSUMER_KEY: 'ck', GARMIN_CONSUMER_SECRET: 'cs' } as Record<string, string>)[n];

  it('deregisters Garmin and Polar, skips COROS, and treats "already gone" as done', async () => {
    const f = fakeFetch({
      [GARMIN_REGISTRATION_URL]: { status: 404 },
      'https://www.polaraccesslink.com/v3/users/987': { status: 204 },
    });
    const failures = await deregisterConnections([
      { device_type: 'garmin', secrets: { access_token: 'gt', token_secret: 'gs' }, metadata: {} },
      { device_type: 'polar', secrets: { access_token: 'pt', x_user_id: '987' }, metadata: {} },
      { device_type: 'coros', secrets: { access_token: 'ct' }, metadata: {} },
    ], env, f.impl);
    expect(failures).toEqual([]);
    expect(f.calls.map(c => [c.url, c.init?.method])).toEqual([
      [GARMIN_REGISTRATION_URL, 'DELETE'],
      ['https://www.polaraccesslink.com/v3/users/987', 'DELETE'],
    ]);
    expect(String((f.calls[0].init?.headers as Record<string, string>).Authorization)).toMatch(/^OAuth .*oauth_signature="/);
  });

  it('collects failures without stopping at the first one', async () => {
    const f = fakeFetch({ [GARMIN_REGISTRATION_URL]: { status: 503 } });
    const failures = await deregisterConnections([
      { device_type: 'garmin', secrets: { access_token: 'gt', token_secret: 'gs' }, metadata: {} },
      { device_type: 'polar', secrets: { access_token: 'pt' }, metadata: { provider_user_id: 5 } },
    ], env, f.impl);
    expect(failures).toEqual(['garmin_503', 'polar_500']);
  });
});
