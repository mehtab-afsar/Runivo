import { describe, it, expect } from 'vitest';
import { buildRunSummary, formatPace, paceSecPerKm } from './runSummary';

const base = { newZones: 0, stolenZones: 0, paceEarned: 0, streakDays: 0 };

describe('free post-run summary', () => {
  it('formats pace', () => {
    expect(formatPace(330)).toBe('5:30');
    expect(formatPace(299.6)).toBe('5:00');
    expect(formatPace(0)).toBe('–');
    expect(paceSecPerKm(5, 1650)).toBe(330);
    expect(paceSecPerKm(0.01, 60)).toBe(0);
  });

  it('compares pace with the recent average beyond GPS noise', () => {
    const faster = buildRunSummary({ ...base, distanceKm: 5, durationSec: 1500, recentAvgPaceSecPerKm: 330 });
    expect(faster.lines[0]).toBe('5.00 km at 5:00 /km, 0:30 faster than your recent average.');
    const slower = buildRunSummary({ ...base, distanceKm: 5, durationSec: 1800, recentAvgPaceSecPerKm: 330 });
    expect(slower.lines[0]).toContain('an easier effort than your recent 5:30 /km');
    const same = buildRunSummary({ ...base, distanceKm: 5, durationSec: 1660, recentAvgPaceSecPerKm: 330 });
    expect(same.lines[0]).toContain('right on your usual pace');
    const first = buildRunSummary({ ...base, distanceKm: 3, durationSec: 1080 });
    expect(first.lines[0]).toBe('3.00 km at 6:00 /km.');
  });

  it('leads with a steal, then new ground, then distance', () => {
    expect(buildRunSummary({ ...base, distanceKm: 4, durationSec: 1400, stolenZones: 2, newZones: 1 }).headline)
      .toBe('You took 2 rival zones');
    expect(buildRunSummary({ ...base, distanceKm: 4, durationSec: 1400, newZones: 1 }).headline).toBe('New ground is yours');
    expect(buildRunSummary({ ...base, distanceKm: 12.34, durationSec: 4000 }).headline).toBe('12.3 km in the bank');
    expect(buildRunSummary({ ...base, distanceKm: 0.5, durationSec: 200 }).headline).toBe('Every run counts');
  });

  it('describes zones and how to keep them', () => {
    const s = buildRunSummary({ ...base, distanceKm: 4, durationSec: 1400, newZones: 1, stolenZones: 1 });
    expect(s.lines).toContain('1 new zone and 1 zone taken from a rival. Run through them again within 6 days to keep them fresh.');
    const none = buildRunSummary({ ...base, distanceKm: 4, durationSec: 1400 });
    expect(none.lines).toContain('No new ground this time. Close a loop to claim what\'s inside it.');
  });

  it('explains PACE, including the cap and the per-km rule', () => {
    expect(buildRunSummary({ ...base, distanceKm: 6, durationSec: 2000, paceEarned: 6 }).lines).toContain('+6 PACE earned.');
    expect(buildRunSummary({ ...base, distanceKm: 6, durationSec: 2000, paceEarned: 4, paceCapped: true }).lines)
      .toContain('+4 PACE. You\'ve reached this week\'s cap; it resets Monday.');
    expect(buildRunSummary({ ...base, distanceKm: 6, durationSec: 2000, paceCapped: true }).lines)
      .toContain('No PACE this run: you\'ve reached this week\'s cap. It resets Monday.');
    expect(buildRunSummary({ ...base, distanceKm: 0.8, durationSec: 300 }).lines)
      .toContain('PACE pays per full kilometre. Go a little further next time.');
  });

  it('counts down to the next streak bonus', () => {
    expect(buildRunSummary({ ...base, distanceKm: 3, durationSec: 1000, streakDays: 5, streakAdvanced: true }).lines)
      .toContain('5-day streak. 2 more days to the next bonus.');
    expect(buildRunSummary({ ...base, distanceKm: 3, durationSec: 1000, streakDays: 6, streakAdvanced: true }).lines)
      .toContain('6-day streak. 1 more day to the next bonus.');
    expect(buildRunSummary({ ...base, distanceKm: 3, durationSec: 1000, streakDays: 14, streakAdvanced: true }).lines)
      .toContain('14-day streak. That\'s a streak bonus.');
    expect(buildRunSummary({ ...base, distanceKm: 3, durationSec: 1000, streakDays: 1, streakAdvanced: true }).lines)
      .toContain('Day one of a new streak. Run tomorrow to build it.');
    expect(buildRunSummary({ ...base, distanceKm: 3, durationSec: 1000, streakDays: 9, streakAdvanced: false }).lines
      .some(l => l.includes('streak'))).toBe(false);
  });
});
