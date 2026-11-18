import type { StoredSettings } from './store';

/**
 * Settings that belong to an account, not the phone: consents, who sees you,
 * live sharing, goals. They live in the device-level settings row, so an account
 * switch must put them back to defaults, or the next runner on this phone
 * inherits the previous one's AI consent, live sharing and privacy choices.
 */
export const ACCOUNT_SETTING_KEYS = [
  'aiConsentAt', 'analyticsEnabled', 'offersEnabled', 'liveRunSharingEnabled', 'privacy',
  'mapHideRadiusM', 'mapHideAll', 'goalReward', 'sportGoals', 'weeklyGoalKm', 'paywallShown',
] as const satisfies readonly (keyof StoredSettings)[];

/** Settings with the account-owned values reset; device preferences kept. */
export function withoutAccountSettings(s: StoredSettings, defaults: StoredSettings): StoredSettings {
  const next: StoredSettings = { ...s };
  for (const k of ACCOUNT_SETTING_KEYS) {
    (next as unknown as Record<string, unknown>)[k] = (defaults as unknown as Record<string, unknown>)[k];
  }
  return next;
}
