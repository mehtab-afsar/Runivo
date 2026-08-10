/**
 * formatters.test.ts
 *
 * Pins the exact output of the distance formatters after the launch-readiness
 * audit found four screens hand-rolling `(m/1000).toFixed(n)` instead of these
 * — a duplicate implementation is exactly how RouteCard/SaveRouteSheet's output
 * drifted from the rest of the app in the first place. These tests exist so a
 * future edit to fmtDist/fmtDistShort can't silently change what every screen
 * that now imports them renders.
 */

import { describe, it, expect } from 'vitest';
import { fmtDist, fmtDistShort, fmtDuration, fmtPace } from './formatters';

describe('fmtDist', () => {
  it('formats meters as kilometers to 2 decimal places', () => {
    expect(fmtDist(5000)).toBe('5.00');
    expect(fmtDist(1234)).toBe('1.23');
    expect(fmtDist(0)).toBe('0.00');
  });
});

describe('fmtDistShort', () => {
  it('formats meters as kilometers to 1 decimal place', () => {
    expect(fmtDistShort(5000)).toBe('5.0');
    expect(fmtDistShort(1250)).toBe('1.3');
    expect(fmtDistShort(0)).toBe('0.0');
  });
});

describe('fmtDuration', () => {
  it('omits hours when under 60 minutes', () => {
    expect(fmtDuration(1800)).toBe('30min');
  });
  it('includes hours once over 60 minutes', () => {
    expect(fmtDuration(5400)).toBe('1h 30m');
  });
});

describe('fmtPace', () => {
  it('formats seconds-per-km as m:ss', () => {
    expect(fmtPace(330)).toBe('5:30');
    expect(fmtPace(305)).toBe('5:05');
  });
});
