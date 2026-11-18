import { describe, it, expect } from 'vitest';
import { checkpointWrites, readCheckpoint, PART_SIZE, isPartKey } from './runCheckpoint';
import type { GPSPoint } from '../hooks/useActiveRun';

const START = 1_790_000_000_000;
const pts = (n: number): GPSPoint[] => Array.from({ length: n }, (_, i) => ({
  lat: 12.9716 + i * 1e-5, lng: 77.5946 + i * 1e-5, timestamp: START + i * 1000, speed: 2.84, accuracy: 6.4, altitude: 910.3,
}));

async function roundTrip(points: GPSPoint[], stored = new Map<string, string>(), full = 0) {
  const w = checkpointWrites('run_checkpoint_abc', START, 'run', points, full);
  for (const [k, v] of w.rows) stored.set(k, v);
  const back = await readCheckpoint(stored.get('run_checkpoint_abc')!, async n => stored.get(`run_checkpoint_abc#${n}`) ?? null);
  return { w, back, stored };
}

describe('run checkpoint', () => {
  it('round-trips points at the stored precision', async () => {
    const { back } = await roundTrip(pts(3));
    expect(back.points).toHaveLength(3);
    expect(back.points[2]).toEqual({ lat: 12.97162, lng: 77.59462, timestamp: START + 2000, speed: 2.8, accuracy: 6, altitude: 910 });
    expect(back.activityType).toBe('run');
  });

  it('keeps every row under 1 MB for a 10-hour run at 1 fix a second', async () => {
    const { w, back } = await roundTrip(pts(36_000));
    for (const [, v] of w.rows) expect(v.length).toBeLessThan(1_000_000);
    expect(back.points).toHaveLength(36_000);
  });

  it('rewrites only the parts that changed', async () => {
    const first = await roundTrip(pts(PART_SIZE + 10));
    expect(first.w.fullParts).toBe(1);
    const second = await roundTrip(pts(PART_SIZE + 20), first.stored, first.w.fullParts);
    expect(second.w.rows.map(([k]) => k)).toEqual(['run_checkpoint_abc#1', 'run_checkpoint_abc']);
    expect(second.back.points).toHaveLength(PART_SIZE + 20);
  });

  it('still reads a checkpoint from an older build', async () => {
    const old = JSON.stringify({ startTime: START, points: pts(2), activityType: 'walk' });
    const back = await readCheckpoint(old, async () => null);
    expect(back.points).toHaveLength(2);
    expect(back.activityType).toBe('walk');
  });

  it('tells part rows from meta rows', () => {
    expect(isPartKey('run_checkpoint_abc#0')).toBe(true);
    expect(isPartKey('run_checkpoint_abc')).toBe(false);
  });
});
