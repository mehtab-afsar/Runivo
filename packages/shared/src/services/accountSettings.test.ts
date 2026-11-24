import { describe, it, expect } from 'vitest';
import { withoutAccountSettings, profileColumnsFor, settingsFromProfileRow, SERVER_SETTING_COLUMNS } from './accountSettings';
import { DEFAULT_SETTINGS } from './store';

describe('withoutAccountSettings', () => {
  it('resets consent, sharing and privacy but keeps phone preferences', () => {
    const before = { ...DEFAULT_SETTINGS, aiConsentAt: 123, liveRunSharingEnabled: true, privacy: 'private' as const, darkMode: true, gpsAccuracy: 'standard' as const };
    const after = withoutAccountSettings(before, DEFAULT_SETTINGS);
    expect(after.aiConsentAt).toBe(DEFAULT_SETTINGS.aiConsentAt);
    expect(after.liveRunSharingEnabled).toBe(false);
    expect(after.privacy).toBe(DEFAULT_SETTINGS.privacy);
    expect(after.gpsAccuracy).toBe('standard');
  });
});


describe('profileColumnsFor (partial settings writes)', () => {
  it('writes only the columns for the keys that changed', () => {
    const s = { ...DEFAULT_SETTINGS, distanceUnit: 'mi' as const, privacy: 'public' as const, liveRunSharingEnabled: true };
    expect(profileColumnsFor(s, ['distanceUnit'])).toEqual({ distance_unit: 'mi' });
  });
  it('never sends privacy or live sharing when a phone-only setting changed', () => {
    const s = { ...DEFAULT_SETTINGS, privacy: 'public' as const };
    expect(profileColumnsFor(s, ['soundEnabled', 'hapticEnabled'])).toEqual({});
  });
  it('maps every server key and defaults offers to false', () => {
    const cols = profileColumnsFor({ ...DEFAULT_SETTINGS, offersEnabled: undefined }, Object.keys(SERVER_SETTING_COLUMNS) as (keyof typeof SERVER_SETTING_COLUMNS)[]);
    expect(Object.keys(cols).sort()).toEqual(Object.values(SERVER_SETTING_COLUMNS).sort());
    expect(cols.offers_enabled).toBe(false);
  });
});

describe('settingsFromProfileRow', () => {
  it('reads the server values and skips nulls and bad values', () => {
    expect(settingsFromProfileRow({ profile_visibility: 'private', distance_unit: 'yards', live_run_sharing_enabled: false, notifications_enabled: null }))
      .toEqual({ privacy: 'private', liveRunSharingEnabled: false });
  });
  it('handles a missing row', () => {
    expect(settingsFromProfileRow(null)).toEqual({});
  });
});
