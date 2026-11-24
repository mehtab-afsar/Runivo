import { describe, it, expect } from 'vitest';
import { resolveNotificationRoute as r } from './notificationRoutes';

const ID = '3f1c2b9e-1a2b-4c3d-8e9f-0123456789ab';

describe('notification routes', () => {
  it('opens the feed for kudos and comments (sent with ?post=)', () => {
    expect(r(`/feed?post=${ID}`)).toEqual({ screen: 'Feed', params: { post: ID } });
    expect(r('/feed?post=not-an-id')).toEqual({ screen: 'Feed' });
    expect(r('/feed')).toEqual({ screen: 'Feed' });
  });
  it('opens a club from a join request', () => {
    expect(r(`/club/${ID}`)).toEqual({ screen: 'ClubDetail', params: { clubId: ID } });
  });
  it('opens the activity for /run/:id and the old /run/summary/:id', () => {
    expect(r(`/run/${ID}`)).toEqual({ screen: 'RunSummary', params: { runId: ID } });
    expect(r(`/run/summary/${ID}`)).toEqual({ screen: 'RunSummary', params: { runId: ID } });
  });
  it('keeps /run as the Run tab', () => {
    expect(r('/run')).toEqual({ screen: 'Main', params: { screen: 'Run' } });
  });
  it('opens the map with a valid filter only', () => {
    expect(r('/territory-map?filter=stale')).toEqual({ screen: 'TerritoryMap', params: { initialFilter: 'stale' } });
    expect(r('/territory-map?filter=bogus')).toEqual({ screen: 'TerritoryMap', params: undefined });
    expect(r('/territory/abc')?.screen).toBe('TerritoryMap');
  });
  it('opens a runner from a follow push', () => {
    expect(r(`/profile/${ID}`)).toEqual({ screen: 'UserProfile', params: { userId: ID } });
    expect(r('/profile')).toEqual({ screen: 'Main', params: { screen: 'Profile' } });
  });
  it('covers the simple paths, trailing slashes, and nothing for unknowns', () => {
    for (const [url, screen] of [['/store', 'PACEStore'], ['/store/mine', 'MyRewards'], ['/training', 'TrainingPlan'], ['/history/', 'History'], ['/challenges', 'Challenges'], ['/clubs', 'Club']]) {
      expect(r(url)?.screen).toBe(screen);
    }
    expect(r('/')).toBeNull();
    expect(r('/nope')).toBeNull();
    expect(r(undefined)).toBeNull();
    expect(r('/run/not a uuid')).toBeNull();
  });
});
