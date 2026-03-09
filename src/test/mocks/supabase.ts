import { vi } from 'vitest';

/**
 * Builds a chainable Supabase query mock. Override individual methods per-test
 * by re-assigning the relevant vi.fn() return values.
 */
export function makeMockSupabase(overrides?: {
  subscriptionTier?: string;
  insertError?: string | null;
}) {
  const tier = overrides?.subscriptionTier ?? 'free';
  const insertError = overrides?.insertError ?? null;

  const single = vi.fn().mockResolvedValue({
    data: { subscription_tier: tier },
    error: null,
  });

  const insert = vi.fn().mockResolvedValue({
    data: null,
    error: insertError ? { message: insertError } : null,
  });

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single,
    insert,
  };

  const from = vi.fn().mockReturnValue(chain);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-test-1' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-token', user: { id: 'user-test-1' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from,
    // expose inner mocks for assertions
    _mocks: { from, single, insert, chain },
  };
}
