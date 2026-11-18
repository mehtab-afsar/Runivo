import { describe, it, expect } from 'vitest';
import { withoutAccountSettings } from './accountSettings';
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
