import { describe, it, expect } from 'vitest';
import { advanceBeat, shouldTick } from './beatClock';

describe('advanceBeat', () => {
  it('waits until the beat is due', () => {
    expect(advanceBeat(1000, 990, 333)).toEqual({ fire: false, next: 1000 });
  });

  it('fires on time and keeps the grid (no drift from a slightly late tick)', () => {
    expect(advanceBeat(1000, 1012, 333)).toEqual({ fire: true, next: 1333 });
  });

  it('keeps a steady tempo over many 25 ms ticks', () => {
    const interval = 60_000 / 180;
    let next = 0, fired = 0;
    for (let t = 0; t <= 10_000; t += 25) {
      const s = advanceBeat(next, t, interval);
      next = s.next;
      if (s.fire) fired++;
    }
    expect(fired).toBe(31); // 10 s at 180 BPM, first beat at t=0
  });

  it('after a long stall (locked screen, busy JS) fires ONE click, not a catch-up burst', () => {
    const interval = 333;
    const resumed = advanceBeat(1000, 31_000, interval);
    expect(resumed).toEqual({ fire: true, next: 31_333 });
    // The very next tick must not fire again.
    expect(advanceBeat(resumed.next, 31_025, interval).fire).toBe(false);
  });

  it('picks up a changed BPM on the next beat', () => {
    const a = advanceBeat(0, 0, 60_000 / 150);
    const b = advanceBeat(a.next, a.next, 60_000 / 180);
    expect(b.next - a.next).toBeCloseTo(60_000 / 180);
  });
});

describe('shouldTick', () => {
  const on = { enabled: true, running: true, foreground: true };
  it('ticks only when enabled, running and in the foreground', () => {
    expect(shouldTick(on)).toBe(true);
    expect(shouldTick({ ...on, enabled: false })).toBe(false);
    expect(shouldTick({ ...on, running: false })).toBe(false); // paused / not started
    expect(shouldTick({ ...on, foreground: false })).toBe(false); // locked screen / backgrounded
  });
});
