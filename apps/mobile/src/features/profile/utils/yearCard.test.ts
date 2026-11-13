import { describe, it, expect } from 'vitest';
import { yearHighlights, buildYearSvg, fmtArea } from './yearCard';

const y = { year: 2026, activities: 140, km: 1204.3, hours: 112.4, longestKm: 21.1, activeDays: 120, zonesClaimed: 61, paceEarned: 4200,
  biggestStealM2: 30000, biggestStealFrom: 'ben<b>', timesStolenFrom: 4, biggestZoneM2: 152000, bestMonth: 3, bestMonthKm: 140.2 };

describe('year card', () => {
  it('lists the highlights, skipping empty ones', () => {
    const labels = yearHighlights(y).map(r => r.label);
    expect(labels).toEqual(['Distance', 'Activities', 'Time moving', 'Zones claimed', 'PACE earned', 'Biggest steal', 'Biggest zone held', 'Best month']);
    expect(yearHighlights({ ...y, paceEarned: 0, biggestStealM2: null, biggestZoneM2: null, bestMonth: null }).length).toBe(4);
  });
  it('formats areas and escapes names', () => {
    expect(fmtArea(30000)).toBe('3.0 ha');
    expect(fmtArea(1_520_000)).toBe('1.52 km²');
    const svg = buildYearSvg(y, 'me & you');
    expect(svg).toContain('me &amp; you');
    expect(svg).toContain('ben&lt;b&gt;');
    expect(svg).toContain('1,204 km');
  });
});
