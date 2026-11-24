import { describe, it, expect } from 'vitest';
import { getStateFromPath } from '@react-navigation/core';
import { linkingConfig } from './linkingConfig';

type S = { routes: { name: string; params?: Record<string, unknown> }[] } | undefined;
const resolve = (path: string) => getStateFromPath(path, linkingConfig as never) as S;
const names = (path: string) => resolve(path)?.routes.map(r => r.name);

describe('deep link config', () => {
  it('always puts the tabs (Main) under a linked screen, so Back works on a cold start', () => {
    expect(linkingConfig.initialRouteName).toBe('Main');
    expect(names('history')).toEqual(['Main', 'History']);
    expect(names('events')).toEqual(['Main', 'Events']);
    expect(names('clubs')).toEqual(['Main', 'Club']);
    expect(names('challenges/3f6b1c2e-0000-4000-8000-000000000001')).toEqual(['Main', 'ChallengeDetail']);
    expect(names('run/summary/abc')).toEqual(['Main', 'RunSummary']);
  });

  it('opens the root on Main alone', () => {
    expect(names('')).toEqual(['Main']);
  });

  it('has no Subscription path while subscriptions are off', () => {
    expect('Subscription' in linkingConfig.screens).toBe(false);
    expect(names('subscription')?.includes('Subscription') ?? false).toBe(false);
  });

  it('resolves the links the app and server send', () => {
    expect(names('settings')).toEqual(['Main', 'Settings']);
    expect(names('store')).toEqual(['Main', 'PACEStore']);
    expect(resolve('feed?post=p1')?.routes[1]).toMatchObject({ name: 'Feed', params: { post: 'p1' } });
    expect(resolve('r/u1')?.routes[1]).toMatchObject({ name: 'UserProfile', params: { userId: 'u1' } });
    expect(resolve('runner/u1')?.routes[1]).toMatchObject({ name: 'UserProfile', params: { userId: 'u1' } });
  });
});
