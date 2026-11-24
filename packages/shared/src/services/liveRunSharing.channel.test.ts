import { describe, it, expect, vi } from 'vitest';

const topics: string[] = [];
const removed: string[] = [];
vi.mock('./supabase', () => {
  const channel = (topic: string) => {
    topics.push(topic);
    const ch = { topic, on: () => ch, subscribe: () => ch };
    return ch;
  };
  return { supabase: { channel, removeChannel: (ch: { topic: string }) => { removed.push(ch.topic); } } };
});

import { subscribeLiveFriendPositions } from './liveRunSharing';

describe('live friend positions realtime (B06)', () => {
  it('gives every subscriber its own channel, so one unmount cannot close another screen\'s', () => {
    const offHome = subscribeLiveFriendPositions(() => {}, () => {});
    const offMap = subscribeLiveFriendPositions(() => {}, () => {});
    expect(new Set(topics).size).toBe(2);
    offHome();
    expect(removed).toEqual([topics[0]]);
    offMap();
    expect(removed).toEqual([topics[0], topics[1]]);
  });
});
