import { RC_PRODUCT_MONTHLY, RC_PRODUCT_ANNUAL } from './services/purchaseService';
import type { PaywallReason } from '@shared/engine/entitlements';

export { PLAN_ROWS } from '@shared/engine/entitlements';
export type { PaywallReason };

// Matches profiles.subscription_tier exactly. 'admin' is an internal/comp
// tier, treated as Plus everywhere (entitlements.isPlus).
export type SubscriptionTier = 'free' | 'premium' | 'admin';

export interface Plan {
  id: 'monthly' | 'annual';
  label: string;
  /** Fallback when RevenueCat prices haven't loaded (PRD pricing, US/EU). */
  fallbackPrice: string;
  period: string;
  /** Free trial: annual only, to steer runners to annual (PRD). */
  trialDays: number;
  rcProductId: string;
}

export const PLANS: Plan[] = [
  { id: 'annual',  label: 'Annual',  fallbackPrice: '$59.99', period: '/yr', trialDays: 7, rcProductId: RC_PRODUCT_ANNUAL },
  { id: 'monthly', label: 'Monthly', fallbackPrice: '$7.99',  period: '/mo', trialDays: 0, rcProductId: RC_PRODUCT_MONTHLY },
];

/** Headline (uppercase hero; last word in red) and line for each paywall moment. */
export const PAYWALL_COPY: Record<PaywallReason | 'default', { lead: string; accent: string; sub: string }> = {
  zone_limit: {
    lead: 'Hold the whole', accent: 'city.',
    sub: 'Free runners hold 10 zones at once. With Plus there is no limit, so every loop you close stays yours.',
  },
  pace_cap: {
    lead: 'Keep', accent: 'earning.',
    sub: 'You\'ve earned this week\'s 100 PACE. Plus raises your weekly cap to 150, so every run keeps paying.',
  },
  debrief: {
    lead: 'Meet your', accent: 'coach.',
    sub: 'PaceX reads every run (pace, effort, the ground you took) and tells you exactly what to do next.',
  },
  events: {
    lead: 'Host the', accent: 'run.',
    sub: 'Plus lets you create races and meetups for runners in your city.',
  },
  map_styles: {
    lead: 'See your city', accent: 'differently.',
    sub: 'Terrain and satellite maps come with Plus.',
  },
  default: {
    lead: 'Own more of your', accent: 'city.',
    sub: 'Unlimited zones, a higher PACE cap, and PaceX, the coach that reads every run.',
  },
};
