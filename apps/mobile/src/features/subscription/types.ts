import type { Icon } from 'phosphor-react-native';
import { MapTrifold, Lightning, Calendar, Brain, BellRinging, ForkKnife } from 'phosphor-react-native';
import { RC_PRODUCT_MONTHLY, RC_PRODUCT_ANNUAL } from './services/purchaseService';
import { GAME_CONFIG } from '@shared/services/config';

// Matches profiles.subscription_tier exactly (migration 042 consolidated the
// prior 3-tier enum — 'runner-plus'/'territory-lord'/'empire-builder' — down
// to this). 'admin' is an internal/comp tier, treated as premium everywhere.
export type SubscriptionTier = 'free' | 'premium' | 'admin';

export interface Plan {
  id: 'monthly' | 'annual';
  label: string;
  price: string;
  period: string;
  badge: string | null;
  rcProductId: string;
}

export interface PlanFeature {
  name: string;
  sub: string;
  icon: Icon;
  /** False for roadmap items not yet built — shown with a "Soon" badge rather
   *  than presented as an active benefit. Keep in sync with config/features.ts. */
  live: boolean;
}

export const PLANS: Plan[] = [
  { id: 'monthly', label: 'Monthly', price: '$7.99', period: '/mo', badge: null,       rcProductId: RC_PRODUCT_MONTHLY },
  { id: 'annual',  label: 'Annual',  price: '$4.99', period: '/mo', badge: 'SAVE 37%', rcProductId: RC_PRODUCT_ANNUAL  },
];

// Only the first three are actually enforced today (territory cap + PACE cap
// in process-run-territory, event creation via the "premium can create" RLS
// policy). AI Coach / alerts / nutrition are real screens gated by feature
// flags that are currently off — marked `live: false` so the UI shows "Soon"
// instead of promising something a subscriber can't use yet.
export const FEATURES: PlanFeature[] = [
  { name: 'Unlimited territory', sub: 'No cap on zones you can claim and own', icon: MapTrifold, live: true },
  { name: 'Higher PACE cap',     sub: `Earn up to ${GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM} PACE/week instead of ${GAME_CONFIG.PACE_WEEKLY_CAP_FREE}`, icon: Lightning, live: true },
  { name: 'Host events',         sub: 'Create races and meetups for the community', icon: Calendar, live: true },
  { name: 'AI Coach',            sub: 'Personalised training plans and weekly briefs', icon: Brain, live: false },
  { name: 'Territory alerts',    sub: 'Notified the moment a rival enters your zone', icon: BellRinging, live: false },
  { name: 'Smart nutrition',     sub: 'Calorie tracker with run-aware coaching', icon: ForkKnife, live: false },
];

export const FREE_LIMITS: string[] = [
  `Max ${GAME_CONFIG.MAX_TERRITORIES_FREE} territories`,
  `${GAME_CONFIG.PACE_WEEKLY_CAP_FREE} PACE/week cap`,
];
