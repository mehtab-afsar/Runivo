import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = { settings: {} as Record<string, unknown>, serverConsent: null as string | null, session: true, updateError: null as unknown };
  const calls: string[] = [];
  return { state, calls };
});

vi.mock('./store', () => ({
  getSettings: vi.fn(async () => ({ ...h.state.settings })),
  saveSettings: vi.fn(async (s: Record<string, unknown>) => { h.calls.push('local'); h.state.settings = s; }),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: h.state.session ? { user: { id: 'u1' } } : null } })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ai_consent_at: h.state.serverConsent } }) }) }),
      update: (patch: { ai_consent_at: string | null }) => ({
        eq: async () => { h.calls.push('server'); if (!h.state.updateError) h.state.serverConsent = patch.ai_consent_at; return { error: h.state.updateError }; },
      }),
    }),
  },
}));

import { hasAiConsent, setAiConsent } from './aiConsent';

describe('AI consent', () => {
  beforeEach(() => {
    h.state.settings = {}; h.state.serverConsent = null; h.state.session = true; h.state.updateError = null; h.calls.length = 0;
  });

  it('is off until the runner agrees', async () => {
    expect(await hasAiConsent()).toBe(false);
  });

  it('restores consent from the server on a fresh install and remembers it locally', async () => {
    h.state.serverConsent = '2026-11-15T10:00:00Z';
    expect(await hasAiConsent()).toBe(true);
    expect(h.state.settings.aiConsentAt).toBeTruthy();
  });

  it('writes the server before the phone, so "on" never outruns the authority', async () => {
    expect(await setAiConsent(true)).toBe(true);
    expect(h.calls).toEqual(['server', 'local']);
    expect(await hasAiConsent()).toBe(true);
  });

  it('does not record consent locally when the server write fails', async () => {
    h.state.updateError = new Error('offline');
    expect(await setAiConsent(true)).toBe(false);
    expect(h.state.settings.aiConsentAt).toBeUndefined();
    expect(await hasAiConsent()).toBe(false);
  });

  it('withdrawing clears both copies', async () => {
    await setAiConsent(true);
    expect(await setAiConsent(false)).toBe(true);
    expect(h.state.serverConsent).toBeNull();
    expect(await hasAiConsent()).toBe(false);
  });

  it('fails closed when signed out', async () => {
    h.state.session = false;
    expect(await hasAiConsent()).toBe(false);
    expect(await setAiConsent(true)).toBe(false);
  });
});
