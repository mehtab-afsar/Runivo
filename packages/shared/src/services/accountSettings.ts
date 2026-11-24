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

/** Phone setting → profiles column, for the settings that live on the server too. */
export const SERVER_SETTING_COLUMNS = {
  distanceUnit:          'distance_unit',
  notificationsEnabled:  'notifications_enabled',
  missionDifficulty:     'mission_difficulty',
  runReminders:          'run_reminders_enabled',
  territoryAlerts:       'territory_alerts_enabled',
  announceAchievements:  'announce_achievements_enabled',
  weeklySummary:         'weekly_summary_enabled',
  offersEnabled:         'offers_enabled',
  privacy:               'profile_visibility',
  liveRunSharingEnabled: 'live_run_sharing_enabled',
} as const satisfies Partial<Record<keyof StoredSettings, string>>;

export type ServerSettingKey = keyof typeof SERVER_SETTING_COLUMNS;

/**
 * The profiles columns to write for a settings change: only the keys that changed.
 * Writing every column on every toggle pushed stale phone values over the server
 * (a teen's private profile went public when they switched km to mi).
 */
export function profileColumnsFor(settings: StoredSettings, changed: readonly (keyof StoredSettings)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of changed) {
    if (!(k in SERVER_SETTING_COLUMNS)) continue;
    const col = SERVER_SETTING_COLUMNS[k as ServerSettingKey];
    const v = settings[k];
    out[col] = k === 'offersEnabled' ? (v ?? false) : v;
  }
  return out;
}

/** A profiles row (any subset of the columns above) as phone settings; unknown or null values are left out. */
export function settingsFromProfileRow(row: Record<string, unknown> | null | undefined): Partial<StoredSettings> {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(SERVER_SETTING_COLUMNS)) {
    const v = row[col];
    if (v === null || v === undefined) continue;
    if (k === 'distanceUnit' && v !== 'km' && v !== 'mi') continue;
    if (k === 'privacy' && v !== 'public' && v !== 'followers' && v !== 'private') continue;
    if (k === 'missionDifficulty' && v !== 'easy' && v !== 'mixed' && v !== 'hard') continue;
    out[k] = v;
  }
  return out as Partial<StoredSettings>;
}
