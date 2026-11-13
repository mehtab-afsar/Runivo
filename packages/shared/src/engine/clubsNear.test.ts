import { describe, it, expect } from 'vitest';
import { clubDistanceLabel, clubsSectionTitle, clubMetaLine } from './clubsNear';

describe('clubDistanceLabel', () => {
  it.each([
    [0, 'Under 1 km'], [0.4, 'Under 1 km'], [1, '1.0 km'], [4.6, '4.6 km'], [9.94, '9.9 km'], [12.4, '12 km'], [14.6, '15 km'],
  ])('%s km → %s', (km, label) => {
    expect(clubDistanceLabel(km)).toBe(label);
  });

  it('is null when there is no usable distance', () => {
    expect(clubDistanceLabel(null)).toBeNull();
    expect(clubDistanceLabel(undefined)).toBeNull();
    expect(clubDistanceLabel(NaN)).toBeNull();
    expect(clubDistanceLabel(-1)).toBeNull();
  });
});

describe('clubsSectionTitle', () => {
  it('says near you only for nearby results', () => {
    expect(clubsSectionTitle(true)).toBe('Clubs near you');
    expect(clubsSectionTitle(false)).toBe('Popular clubs');
  });
});

describe('clubMetaLine', () => {
  it('leads with distance and area when near', () => {
    expect(clubMetaLine({ distance_km: 4.6, city: 'Indiranagar', member_count: 12, total_km: 812.4 }))
      .toBe('4.6 km · Indiranagar · 12 members · 812 km run');
  });

  it('drops distance for popular clubs and singularises one member', () => {
    expect(clubMetaLine({ distance_km: null, member_count: 1, total_km: 0 })).toBe('1 member · 0 km run');
  });
});
