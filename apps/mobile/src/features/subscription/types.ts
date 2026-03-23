import { RC_PRODUCT_MONTHLY, RC_PRODUCT_ANNUAL } from './services/purchaseService';

export type SubscriptionTier = 'free' | 'runner-plus';

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
}

export const PLANS: Plan[] = [
  { id: 'monthly', label: 'Monthly', price: '$7.99', period: '/mo', badge: null,       rcProductId: RC_PRODUCT_MONTHLY },
  { id: 'annual',  label: 'Annual',  price: '$4.99', period: '/mo', badge: 'SAVE 37%', rcProductId: RC_PRODUCT_ANNUAL  },
];

export const FEATURES: PlanFeature[] = [
  { name: 'Unlimited territory',   sub: 'No cap on zones you can claim and own' },
  { name: 'AI Coach',              sub: 'Personalised training plans, weekly briefs, race predictions' },
  { name: 'Real-time alerts',      sub: 'Notified the moment a rival enters your zone' },
  { name: 'Create clubs & events', sub: 'Build your running crew, host races' },
  { name: 'Smart nutrition + AI',  sub: 'Calorie tracker with run-aware coaching' },
  { name: 'Advanced analytics',    sub: 'Pace zones, performance trends, VDOT' },
];

export const FREE_LIMITS: string[] = [
  'Max 20 territories',
  'No AI Coach',
  'No territory alerts',
];
