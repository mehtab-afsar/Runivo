/**
 * entitlements — what Free and Runivo Plus get, and when to show the paywall.
 *
 * The rule (PRD, "Free vs Runivo Plus"): never charge for the game itself,
 * safety or privacy. Charge for scale and intelligence. A free runner can
 * claim, defend and compete; Plus is for more ground and a coach.
 */
import { weeklyCapFor } from './runEngine';

export { weeklyCapFor };

export type Tier = 'free' | 'premium' | 'admin' | string | null | undefined;

export const FREE_ZONE_LIMIT = 10;

/**
 * Subscriptions are switched off while Runivo is still being built: every
 * runner gets everything Plus has, and no paywall, upgrade prompt or Plus
 * screen is shown. The server follows its own matching switch
 * (app_settings.subscriptions_enabled, and SUBSCRIPTIONS_ENABLED for the edge
 * functions). Flip all three to true at launch; the stored subscription_tier
 * is never changed, so paying runners keep Plus and everyone else goes back
 * to Free.
 */
export const SUBSCRIPTIONS_ENABLED = false;

/** The tier rule itself: premium and admin are Plus. */
export function isPlusTier(tier: Tier): boolean {
  return tier === 'premium' || tier === 'admin';
}

/** The tier the game applies: the stored one, or Plus for all while subscriptions are off. */
let subscriptionsOn = SUBSCRIPTIONS_ENABLED;
export function effectiveTier(tier: Tier): Tier {
  return subscriptionsOn ? tier : 'premium';
}

/** Tests only: check the Free/Plus rules as they'll run once subscriptions are on. */
export function setSubscriptionsEnabledForTests(on: boolean): void {
  subscriptionsOn = on;
}

export function isPlus(tier: Tier): boolean {
  return isPlusTier(effectiveTier(tier));
}

/** Zones a runner can hold at once. */
export function zoneLimitFor(tier: Tier): number {
  return isPlus(tier) ? Infinity : FREE_ZONE_LIMIT;
}

export type Feature =
  // Free for everyone: the game, safety and the social layer.
  | 'run_tracking'
  | 'territory'
  | 'territory_alerts'
  | 'leaderboards'
  | 'feed'
  | 'clubs'
  | 'create_clubs'
  | 'club_chat'
  | 'live_friend_map'
  | 'pacex_summary'
  // Plus: scale and intelligence.
  | 'territory_unlimited'
  | 'pacex_debrief'
  | 'pacex_weekly_brief'
  | 'pacex_chat'
  | 'training_plan'
  | 'host_events'
  | 'plus_store_drops'
  | 'extra_map_styles'
  | 'advanced_analytics';

export const PLUS_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  'territory_unlimited',
  'pacex_debrief',
  'pacex_weekly_brief',
  'pacex_chat',
  'training_plan',
  'host_events',
  'plus_store_drops',
  'extra_map_styles',
  'advanced_analytics',
]);

/**
 * X6, the line: tracking, territory, safety, clubs and the store are free;
 * Plus adds training plans. Flip to false to make plans free again — the
 * builder, the paywall copy and the Plus table all follow this one switch.
 * Runners who already have a plan keep it either way.
 */
export const TRAINING_PLANS_PLUS = true;

export function canUse(feature: Feature, tier: Tier): boolean {
  if (feature === 'training_plan' && !TRAINING_PLANS_PLUS) return true;
  return PLUS_FEATURES.has(feature) ? isPlus(tier) : true;
}

/** Can a runner holding `ownedCount` zones claim one more? */
export function canClaimZone(ownedCount: number, tier: Tier): boolean {
  return ownedCount < zoneLimitFor(tier);
}

// ── Paywall moments ──────────────────────────────────────────────────────────

export type PaywallTrigger = 'zone_limit' | 'pace_cap' | 'debrief';
export type PaywallReason = PaywallTrigger | 'events' | 'map_styles' | 'training';

/** Opening the full debrief only sells Plus once the runner has a few runs to reflect on. */
export const DEBRIEF_PAYWALL_AFTER_RUNS = 3;

/**
 * Whether to put the paywall in front of the runner right now. The three
 * moments from the PRD: an 11th-zone claim (they're winning), hitting the
 * weekly PACE cap, and opening a full PaceX debrief after the third run.
 * Never on first launch, never for Plus, at most once per trigger per week.
 */
export function paywallMoment(params: {
  trigger: PaywallTrigger;
  tier: Tier;
  runsCompleted: number;
  isFirstLaunch: boolean;
  alreadyShownThisWeek: boolean;
}): boolean {
  const { trigger, tier, runsCompleted, isFirstLaunch, alreadyShownThisWeek } = params;
  if (isPlus(tier) || isFirstLaunch || alreadyShownThisWeek) return false;
  if (runsCompleted < 1) return false;
  if (trigger === 'debrief') return runsCompleted >= DEBRIEF_PAYWALL_AFTER_RUNS;
  return true;
}

/** Monday-start ISO week key ("2026-W45"), for "once per trigger per week". */
export function paywallWeekKey(nowMs: number): string {
  const d = new Date(nowMs);
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = 1 + Math.floor((thursday.getTime() - yearStart.getTime()) / 86_400_000 / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── The comparison table on the paywall ──────────────────────────────────────

export interface PlanRow { label: string; free: string; plus: string }

export const PLAN_ROWS: readonly PlanRow[] = [
  { label: 'Run tracking, territory, steals, leaderboards', free: 'Yes', plus: 'Yes' },
  { label: 'Feed, clubs, club chat, live friend map', free: 'Yes', plus: 'Yes' },
  { label: 'Zones you can hold at once', free: String(FREE_ZONE_LIMIT), plus: 'Unlimited' },
  { label: 'Weekly PACE cap', free: String(weeklyCapFor('free')), plus: String(weeklyCapFor('premium')) },
  { label: 'PaceX after a run', free: 'Short summary', plus: 'Full debrief' },
  { label: 'PaceX weekly brief', free: 'No', plus: 'Yes' },
  { label: 'Host events', free: 'No', plus: 'Yes' },
  { label: 'Plus-only PACE Store drops', free: 'No', plus: 'Yes' },
  { label: 'Extra map styles', free: 'No', plus: 'Yes' },
];

/**
 * The Free vs Plus rows the paywall shows (PRD X5): only perks that are live,
 * with numbers from the same rules the game enforces. `live` says which
 * switched-on features the build has (e.g. the AI coach flag).
 */
export function paywallRows(live: { aiCoach: boolean; weeklyBrief?: boolean }): PlanRow[] {
  const rows: PlanRow[] = [
    { label: 'Zones you can hold', free: String(FREE_ZONE_LIMIT), plus: 'Unlimited' },
    { label: 'Weekly PACE cap', free: String(weeklyCapFor('free')), plus: String(weeklyCapFor('premium')) },
  ];
  if (live.aiCoach) {
    rows.push({ label: 'PaceX after a run', free: 'Summary', plus: 'Full debrief' });
    rows.push({ label: 'Chat with PaceX', free: 'No', plus: 'Yes' });
    if (live.weeklyBrief) rows.push({ label: 'PaceX weekly brief', free: 'No', plus: 'Yes' });
  }
  if (TRAINING_PLANS_PLUS) rows.push({ label: 'Race training plans', free: 'No', plus: 'Yes' });
  // Enforced by the events insert policy (20260811000002); club runs need no Plus.
  rows.push({ label: 'Host public events', free: 'No', plus: 'Yes' });
  rows.push({ label: 'Plus-only store rewards', free: 'No', plus: 'Yes' });
  rows.push({ label: 'Extra map styles', free: 'No', plus: 'Yes' });
  return rows;
}

/** The store's price when we have it; never a made-up number. */
export function displayPrice(storePrice: string | null | undefined): string | null {
  const p = storePrice?.trim();
  return p ? p : null;
}
