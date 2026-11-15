import { beforeEach, describe, expect, it, vi } from 'vitest';

// magicLink installs its Linking listeners at import, so stub react-native and
// the Supabase client before loading it.
vi.mock('react-native', () => ({
  Linking: {
    getInitialURL: vi.fn().mockResolvedValue(null),
    addEventListener: vi.fn(),
  },
}));

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock('@shared/services/supabase', () => ({ supabase: { auth } }));

import { handleMagicLinkUrl, onMagicLinkResult } from './magicLink';

let n = 0;
const link = (qs: string) => `runivo://auth/magic?${qs}&n=${n++}`; // unique, since handled links are de-duplicated

describe('handleMagicLinkUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it('ignores URLs that are not magic links', async () => {
    expect(await handleMagicLinkUrl('runivo://auth/callback?code=abc')).toBe(false);
    expect(await handleMagicLinkUrl('https://evil.example/auth/magic?code=abc')).toBe(false);
    expect(await handleMagicLinkUrl(null)).toBe(false);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('exchanges a PKCE code for a session', async () => {
    const results: unknown[] = [];
    const off = onMagicLinkResult(r => results.push(r));
    expect(await handleMagicLinkUrl(link('code=good'))).toBe(true);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('good');
    expect(results).toEqual([{ ok: true }]);
    off();
  });

  it('never accepts a bare token_hash (no device binding, login-CSRF risk)', async () => {
    const results: Array<{ ok: boolean }> = [];
    const off = onMagicLinkResult(r => results.push(r));
    await handleMagicLinkUrl(link('token_hash=attacker'));
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    off();
  });

  it('does not swap the account when someone is already signed in', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    expect(await handleMagicLinkUrl(link('code=other-account'))).toBe(true);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports an expired link without calling Supabase', async () => {
    const results: Array<{ ok: boolean }> = [];
    const off = onMagicLinkResult(r => results.push(r));
    await handleMagicLinkUrl(link('error=access_denied&error_description=expired'));
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(results[0].ok).toBe(false);
    off();
  });

  it('handles the same link only once', async () => {
    const url = link('code=dup');
    await handleMagicLinkUrl(url);
    await handleMagicLinkUrl(url);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});
