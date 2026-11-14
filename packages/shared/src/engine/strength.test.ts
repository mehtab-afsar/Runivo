import { describe, it, expect } from 'vitest';
import { STRENGTH_SESSIONS, sessionSeconds } from './strength';

describe('strength library (T8)', () => {
  it('every session lands within a couple of minutes of its stated length', () => {
    for (const s of STRENGTH_SESSIONS) {
      expect(Math.abs(sessionSeconds(s) / 60 - s.minutes)).toBeLessThanOrEqual(3);
      expect(s.steps[s.steps.length - 1].rest).not.toBe(true);
    }
  });
  it('sessions run 8 to 20 minutes', () => {
    for (const s of STRENGTH_SESSIONS) {
      expect(s.minutes).toBeGreaterThanOrEqual(8);
      expect(s.minutes).toBeLessThanOrEqual(20);
    }
  });
});
