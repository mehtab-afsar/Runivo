import { describe, it, expect } from 'vitest';
import {
  sportGroup, filterBySport, weekStart, weeklyTotals, periodStats,
  activityTitle, paceOrSpeed, fmtHours, fmtKm, fmtClock,
} from './profileStats';

const at = (y: number, mo: number, d: number, h = 8) => new Date(y, mo, d, h).getTime();
const act = (t: string, start: number, km: number, min: number) =>
  ({ activityType: t, startTime: start, distanceMeters: km * 1000, durationSec: min * 60 });

describe('sportGroup / filterBySport', () => {
  it('groups hikes with walks and every running type with runs', () => {
    expect(sportGroup('hike')).toBe('walk');
    expect(sportGroup('trail_run')).toBe('run');
    expect(sportGroup('interval')).toBe('run');
    expect(sportGroup(undefined)).toBe('run');
    expect(sportGroup('cycle')).toBe('ride');
  });
  it('filters by sport and keeps everything for all', () => {
    const runs = [act('run', 0, 5, 25), act('cycle', 0, 20, 50), act('hike', 0, 8, 120)];
    expect(filterBySport(runs, 'all')).toHaveLength(3);
    expect(filterBySport(runs, 'ride').map(r => r.activityType)).toEqual(['cycle']);
    expect(filterBySport(runs, 'walk').map(r => r.activityType)).toEqual(['hike']);
  });
});

describe('weekStart / weeklyTotals', () => {
  it('starts weeks on Monday', () => {
    // Thu 12 Nov 2026 → Mon 9 Nov 2026
    expect(weekStart(at(2026, 10, 12, 21))).toBe(new Date(2026, 10, 9).getTime());
    // Sunday belongs to the week that began the Monday before
    expect(weekStart(at(2026, 10, 15, 23))).toBe(new Date(2026, 10, 9).getTime());
  });
  it('sums each calendar week, oldest first, this week last', () => {
    const now = at(2026, 10, 12);
    const w = weeklyTotals([
      act('run', at(2026, 10, 10), 5, 25),
      act('run', at(2026, 10, 9, 6), 3, 15),
      act('run', at(2026, 10, 2), 10, 50),      // last week
      act('run', at(2026, 7, 1), 42, 240),      // far outside 12 weeks
    ], now, 12);
    expect(w).toHaveLength(12);
    expect(w[11]).toMatchObject({ km: 8, count: 2, sec: 40 * 60 });
    expect(w[10]).toMatchObject({ km: 10, count: 1 });
    expect(w.slice(0, 10).every(x => x.count === 0)).toBe(true);
  });
});

describe('periodStats', () => {
  const runs = [act('run', at(2026, 0, 3), 5, 30), act('run', at(2025, 11, 30), 21.1, 120)];
  it('counts from 1 January for the year', () => {
    expect(periodStats(runs, 'year', at(2026, 10, 12))).toEqual({ count: 1, km: 5, sec: 1800, longestKm: 5 });
  });
  it('counts everything for all time', () => {
    const s = periodStats(runs, 'all', at(2026, 10, 12));
    expect(s.count).toBe(2);
    expect(s.longestKm).toBeCloseTo(21.1);
  });
});

describe('formatting', () => {
  it('titles activities by time of day and sport', () => {
    expect(activityTitle({ activityType: 'run', startTime: at(2026, 0, 1, 7) })).toBe('Morning run');
    expect(activityTitle({ activityType: 'cycle', startTime: at(2026, 0, 1, 18) })).toBe('Evening ride');
    expect(activityTitle({ activityType: 'hike', startTime: at(2026, 0, 1, 14) })).toBe('Afternoon hike');
    expect(activityTitle({ activityType: 'trail_run', startTime: at(2026, 0, 1, 23) })).toBe('Night trail run');
  });
  it('gives pace on foot and speed on a bike', () => {
    expect(paceOrSpeed(5, 25 * 60, 'run')).toEqual({ value: '5:00', unit: '/km' });
    expect(paceOrSpeed(20, 3600, 'ride')).toEqual({ value: '20.0', unit: 'km/h' });
    expect(paceOrSpeed(0, 0, 'run').value).toBe('–');
    // 4:59.6 rounds up to the next minute, never "4:60"
    expect(paceOrSpeed(1, 299.6, 'run').value).toBe('5:00');
  });
  it('formats hours and km', () => {
    expect(fmtHours(3840)).toBe('1h 04m');
    expect(fmtHours(1920)).toBe('32m');
    expect(fmtKm(0.43)).toBe('0.4');
    expect(fmtKm(123.4)).toBe('123');
    expect(fmtKm(1234.5)).toBe('1,235');
    expect(fmtClock(130)).toBe('2:10');
    expect(fmtClock(3845)).toBe('1:04:05');
  });
});

describe('excluded activities', () => {
  it('stay out of weekly and period totals', () => {
    const now = new Date(2026, 10, 12, 12).getTime();
    const runs = [
      { activityType: 'run', startTime: now - 3600e3, distanceMeters: 5000, durationSec: 1500 },
      { activityType: 'run', startTime: now - 7200e3, distanceMeters: 90000, durationSec: 1500, excluded: true },
    ];
    expect(weeklyTotals(runs, now, 1)[0].km).toBeCloseTo(5);
    expect(periodStats(runs, 'year', now)).toMatchObject({ count: 1, longestKm: 5 });
  });
});
