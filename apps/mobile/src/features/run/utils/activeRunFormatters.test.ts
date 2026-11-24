import { describe, expect, it } from 'vitest';
import { fmtArea, fmtPaceSecs, fmtTime } from './activeRunFormatters';
import { buildBanner, buildLoopRow, type BannerInput, type LoopRowInput } from './activeRunDerived';

describe('activeRun formatters', () => {
  it('formats elapsed time with and without hours', () => {
    expect(fmtTime(65)).toBe('01:05');
    expect(fmtTime(3725)).toBe('1:02:05');
  });

  it('formats pace and guards bad input', () => {
    expect(fmtPaceSecs(330)).toBe('5:30');
    expect(fmtPaceSecs(359.7)).toBe('6:00');
    expect(fmtPaceSecs(0)).toBe('–:––');
    expect(fmtPaceSecs(Infinity)).toBe('–:––');
    expect(fmtPaceSecs(60 * 31)).toBe('–:––');
  });

  it('switches area units at 100,000 m²', () => {
    expect(fmtArea(2500)).toBe(`${(2500).toLocaleString()} m²`);
    expect(fmtArea(250_000)).toBe('0.25 km²');
  });
});

const bannerBase: BannerInput = {
  isRunning: true, speedWarning: false, claims: true, loopClosing: false, nearRival: false,
  isOffRoute: false, isNearRouteEnd: false, routeProgress: null,
};

describe('buildBanner', () => {
  it('is empty when not running or nothing applies', () => {
    expect(buildBanner({ ...bannerBase, isRunning: false, speedWarning: true })).toBeNull();
    expect(buildBanner(bannerBase)).toBeNull();
  });

  it('puts the most urgent banner first', () => {
    expect(buildBanner({ ...bannerBase, speedWarning: true, loopClosing: true })?.tone).toBe('warn');
    expect(buildBanner({ ...bannerBase, loopClosing: true, nearRival: true })?.tone).toBe('own');
    expect(buildBanner({ ...bannerBase, nearRival: true, isOffRoute: true })?.tone).toBe('rival');
  });

  it('words the speed warning per sport', () => {
    expect(buildBanner({ ...bannerBase, speedWarning: true })?.text).toContain('territory');
    expect(buildBanner({ ...bannerBase, speedWarning: true, claims: false })?.text).toContain('ride');
  });

  it('rounds the distance left on the route', () => {
    const b = buildBanner({ ...bannerBase, isNearRouteEnd: true, routeProgress: { closestIdx: 3, distanceToRouteM: 2, distanceRemainingM: 41.6 } });
    expect(b).toEqual({ text: 'Almost there. 42 m to go', tone: 'good' });
  });
});

const loopBase: LoopRowInput = {
  claims: true, isRunning: true, pointCount: 10, distanceKm: 1, loopClosing: false,
  nearStartStripOnly: false, liveAreaM2: 0, toStartM: 450, farthestM: 900,
};

describe('buildLoopRow', () => {
  it('is hidden for rides, idle runs and single points', () => {
    expect(buildLoopRow({ ...loopBase, claims: false })).toBeNull();
    expect(buildLoopRow({ ...loopBase, isRunning: false })).toBeNull();
    expect(buildLoopRow({ ...loopBase, pointCount: 1 })).toBeNull();
  });

  it('counts down to the first claimable distance', () => {
    const row = buildLoopRow({ ...loopBase, distanceKm: 0.05 });
    expect(row?.label).toBe('Run 200 m to start claiming');
    expect(row?.pct).toBeCloseTo(0.25);
  });

  it('reports the loop states', () => {
    expect(buildLoopRow({ ...loopBase, loopClosing: true, liveAreaM2: 5000 })).toMatchObject({ label: 'Loop closed', pct: 1 });
    expect(buildLoopRow({ ...loopBase, nearStartStripOnly: true })).toMatchObject({ label: 'Strip only', pct: 1 });
    expect(buildLoopRow(loopBase)).toEqual({ label: 'Close the loop to claim', detail: '450 m to go', pct: 0.5 });
    expect(buildLoopRow({ ...loopBase, toStartM: 1500, farthestM: 0 })?.detail).toBe('1.5 km to go');
  });
});
