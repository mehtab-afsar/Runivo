import { describe, it, expect } from 'vitest';
import {
  fmt, pace, capFirst, rideSpeed, rankProgress, rejectionText, extraStatsFor, fasterThanUsual, estimateCalories,
} from './runSummaryFormatters';
import { computeOutcome, paceParts } from './runSummaryOutcome';
import type { PassedRunData } from '../hooks/useRunSummary';

describe('fmt', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(fmt(65)).toBe('01:05');
    expect(fmt(3900)).toBe('1:05:00');
    expect(fmt(-5)).toBe('00:00');
  });
});

describe('pace', () => {
  it('formats decimal minutes and guards bad input', () => {
    expect(pace(5.5)).toBe('5:30');
    expect(pace(0)).toBe('–:––');
    expect(pace(Infinity)).toBe('–:––');
    expect(pace(NaN)).toBe('–:––');
  });
});

describe('small helpers', () => {
  it('capFirst', () => expect(capFirst('run')).toBe('Run'));
  it('rideSpeed', () => {
    expect(rideSpeed(20, 3600, 'km')).toBe('20.0');
    expect(rideSpeed(20, 0, 'km')).toBe('0.0');
  });
  it('rejectionText falls back for unknown reasons', () => {
    expect(rejectionText('run_too_short')).toContain('shorter than a minute');
    expect(rejectionText('nope')).toContain('couldn\'t be verified');
  });
});

describe('rankProgress', () => {
  it('sovereign is full', () => expect(rankProgress(99999, 'sovereign')).toEqual({ pct: 1, nextName: '', paceToNext: 0 }));
  it('pacer points at strider', () => {
    const r = rankProgress(0, 'pacer');
    expect(r.nextName).toBe('Strider');
    expect(r.pct).toBe(0);
    expect(r.paceToNext).toBeGreaterThan(0);
  });
});

describe('extraStatsFor', () => {
  it('is empty without data and converts elevation for miles', () => {
    expect(extraStatsFor(null, 'km')).toEqual([]);
    expect(extraStatsFor({ elevationGainM: 100 }, 'mi')).toEqual([{ label: 'Elevation', value: '328 ft' }]);
    expect(extraStatsFor({ perceivedEffort: 9, heartRateAvg: 150.4 }, 'km')).toEqual([
      { label: 'Avg HR', value: '150' }, { label: 'Effort', value: 'Hard' },
    ]);
  });
});

describe('fasterThanUsual', () => {
  it('only fires when clearly faster than the recent average, never for rides', () => {
    expect(fasterThanUsual(false, 360, 5, 1500)?.sub).toBe('60 s/km quicker than your recent runs');
    expect(fasterThanUsual(true, 360, 5, 1500)).toBeNull();
    expect(fasterThanUsual(false, null, 5, 1500)).toBeNull();
    expect(fasterThanUsual(false, 360, 0.5, 100)).toBeNull();
  });
});

describe('estimateCalories', () => {
  it('needs a weight on file', () => {
    expect(estimateCalories(null, 5, 1800)).toBeNull();
    expect(estimateCalories(70, 5, 1800)).toBe(Math.round((Math.max(3.5, Math.min(18, 2.5 + 0.9 * 10)) * 70 * 1800) / 3600));
  });
});

const base: PassedRunData = { distance: 5, duration: 1500, pace: 5, territoriesClaimed: 0 };

describe('computeOutcome', () => {
  it('says "Ride done." for rides and "<Verb> done." with nothing else to report', () => {
    expect(computeOutcome(base, null, null, true, { verb: 'run' }).headline).toBe('Ride done.');
    expect(computeOutcome(base, null, null, false, { verb: 'run' }).headline).toBe('Run done.');
  });
  it('lets the server verdict win: rejected runs are "Not scored."', () => {
    const o = computeOutcome(base, { newZones: 0, stolenZones: 0, paceCapped: false, territoryCapReached: false, streakDays: 0, rejectedReason: 'run_too_short' }, null, false, { verb: 'run' });
    expect(o.headline).toBe('Not scored.');
    expect(o.noGain).toBe(true);
    expect(o.noGainReason).toContain('shorter than a minute');
  });
  it('reports stolen zones', () => {
    const o = computeOutcome({ ...base, rivalZonesStolen: 2 }, null, null, false, { verb: 'run' });
    expect(o.stolen).toBe(2);
    expect(o.headline).toBe('Stole 2 zones.');
  });
});

describe('paceParts', () => {
  const colors = { distance: 'a', stolen: 'b', newZone: 'c', streak: 'd' };
  it('drops zero parts and prefers the server breakdown', () => {
    const parts = paceParts(base, { newZones: 1, stolenZones: 0, paceCapped: false, territoryCapReached: false, streakDays: 0, paceBreakdown: { distance: 10, newZones: 5, stolenZones: 0, streak: 0 } }, colors);
    expect(parts.map(p => [p.key, p.value, p.color])).toEqual([['distance', 10, 'a'], ['new', 5, 'c']]);
  });
  it('is empty for a rejected run', () => {
    expect(paceParts(base, { newZones: 0, stolenZones: 0, paceCapped: false, territoryCapReached: false, streakDays: 0, rejectedReason: 'duration' }, colors)).toEqual([]);
  });
});
