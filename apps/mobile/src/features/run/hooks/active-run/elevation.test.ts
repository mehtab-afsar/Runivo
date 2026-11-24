import { describe, it, expect } from 'vitest';
import { trackElevation } from './elevation';
import { createRunSession } from './session';

describe('trackElevation', () => {
  it('does not count the first reading as a climb from sea level', () => {
    const s = createRunSession();
    trackElevation(s, 40);
    expect(s.elevationGain).toBe(0);
    expect(s.prevAltitude).toBe(40);
  });

  it('skips fixes without altitude and keeps the previous reading', () => {
    const s = createRunSession();
    trackElevation(s, 40);
    trackElevation(s, null);
    trackElevation(s, undefined);
    expect(s.prevAltitude).toBe(40);
  });

  it('ignores noise under 0.5 m and counts real gains only (not descents)', () => {
    const s = createRunSession();
    trackElevation(s, 100);
    trackElevation(s, 100.4);
    expect(s.elevationGain).toBe(0);
    trackElevation(s, 103);
    expect(s.elevationGain).toBeCloseTo(2.6, 5);
    trackElevation(s, 90);
    expect(s.elevationGain).toBeCloseTo(2.6, 5);
  });
});
