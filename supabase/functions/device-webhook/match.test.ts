import { describe, it, expect } from 'vitest';
import { matchConnection, type ConnectionRow } from './match';

const conns: ConnectionRow[] = [
  { user_id: 'alice', secrets: { access_token: 'tok-a' }, metadata: {} },
  { user_id: 'bob',   secrets: { access_token: 'tok-b' }, metadata: { provider_user_id: 'g-bob' } },
];

describe('device webhook matching', () => {
  it('gives the activity to the user whose token it carries, not the first user', () => {
    expect(matchConnection(conns, { providerToken: 'tok-b' })).toMatchObject({ ok: true, userId: 'bob' });
  });
  it('learns the Garmin user id the first time it is seen', () => {
    expect(matchConnection(conns, { providerToken: 'tok-a', providerUserId: 'g-alice' }))
      .toEqual({ ok: true, userId: 'alice', learnProviderUserId: 'g-alice' });
  });
  it('matches on a known Garmin user id after the token changed', () => {
    expect(matchConnection(conns, { providerToken: 'tok-new', providerUserId: 'g-bob' }))
      .toEqual({ ok: true, userId: 'bob', learnProviderUserId: null });
  });
  it('drops activities it cannot place', () => {
    expect(matchConnection(conns, { providerToken: 'tok-zzz' })).toEqual({ ok: false, reason: 'no_match' });
    expect(matchConnection(conns, {})).toEqual({ ok: false, reason: 'no_hint' });
    expect(matchConnection([], { providerToken: 'tok-a' })).toEqual({ ok: false, reason: 'no_match' });
  });
  it('refuses when token and user id point at different people', () => {
    expect(matchConnection(conns, { providerToken: 'tok-a', providerUserId: 'g-bob' })).toEqual({ ok: false, reason: 'ambiguous' });
  });
});
