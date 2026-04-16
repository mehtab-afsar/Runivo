/**
 * useFeatureGate — subscription-aware feature access checks.
 *
 * Usage:
 *   const gate = useFeatureGate();
 *   if (!gate.hasAICoach) navigation.navigate('Subscription');
 *   if (!gate.canClaimTerritory(ownedCount)) showTerritoryPaywall();
 */
import { useSubscription } from './useSubscription';
import { GAME_CONFIG } from '@shared/services/config';

export type GatedFeature =
  | 'ai_coach'
  | 'territory_unlimited'
  | 'territory_alerts'
  | 'create_clubs'
  | 'create_events'
  | 'advanced_analytics';

export interface FeatureGateResult {
  /** Whether the current user has an active paid subscription. */
  isPremium: boolean;
  /** Maximum number of territories this user can own. */
  territoryLimit: number;
  /** True only while the subscription tier is being fetched. */
  loading: boolean;
  /** Check access to a named feature. Returns false while loading. */
  canUse(feature: GatedFeature): boolean;
  /**
   * Check whether the user can claim one more territory given their current count.
   * Returns false if free tier and `currentCount >= MAX_TERRITORIES_FREE`.
   */
  canClaimTerritory(currentOwnedCount: number): boolean;
  /**
   * Same as canClaimTerritory but returns a human-readable reason when blocked.
   * Returns null if access is allowed.
   */
  territoryBlockReason(currentOwnedCount: number): string | null;
}

/** Features that are free for everyone. */
const FREE_FEATURES = new Set<GatedFeature>(['create_clubs']);

/** Features that require a paid tier. */
const PREMIUM_FEATURES = new Set<GatedFeature>([
  'ai_coach',
  'territory_unlimited',
  'territory_alerts',
  'create_events',
  'advanced_analytics',
]);

export function useFeatureGate(): FeatureGateResult {
  const { isPremium, loading } = useSubscription();

  const territoryLimit = isPremium
    ? Infinity
    : GAME_CONFIG.MAX_TERRITORIES_FREE;

  const canUse = (feature: GatedFeature): boolean => {
    if (loading) return false;
    if (FREE_FEATURES.has(feature)) return true;
    if (PREMIUM_FEATURES.has(feature)) return isPremium;
    return true;
  };

  const canClaimTerritory = (currentOwnedCount: number): boolean => {
    if (loading) return false;
    if (isPremium) return true;
    return currentOwnedCount < GAME_CONFIG.MAX_TERRITORIES_FREE;
  };

  const territoryBlockReason = (currentOwnedCount: number): string | null => {
    if (canClaimTerritory(currentOwnedCount)) return null;
    return `Free plan is limited to ${GAME_CONFIG.MAX_TERRITORIES_FREE} territories. Upgrade to claim more.`;
  };

  return {
    isPremium,
    territoryLimit,
    loading,
    canUse,
    canClaimTerritory,
    territoryBlockReason,
  };
}
