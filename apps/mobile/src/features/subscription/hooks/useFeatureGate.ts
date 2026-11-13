/**
 * useFeatureGate — Free vs Runivo Plus access, from the shared rules in
 * packages/shared/src/engine/entitlements.ts (the same rules the server uses).
 *
 * Usage:
 *   const gate = useFeatureGate();
 *   if (!gate.canUse('pacex_chat')) navigation.navigate('Subscription', { reason: 'debrief' });
 *   if (!gate.canClaimTerritory(ownedCount)) showTerritoryPaywall();
 */
import { useSubscription } from './useSubscription';
import {
  canUse as canUseFeature,
  canClaimZone,
  isPlus,
  zoneLimitFor,
  type Feature,
} from '@shared/engine/entitlements';

/** Older names kept so existing call sites keep working. */
type LegacyFeature = 'ai_coach' | 'create_events';
export type GatedFeature = Feature | LegacyFeature;

const LEGACY: Record<LegacyFeature, Feature> = {
  ai_coach: 'pacex_chat',
  create_events: 'host_events',
};

export interface FeatureGateResult {
  /** Whether the current user has Runivo Plus (premium or admin). */
  isPremium: boolean;
  /** Maximum number of territories this user can own. */
  territoryLimit: number;
  /** True only while the subscription tier is being fetched. */
  loading: boolean;
  /** Check access to a named feature. Plus features return false while loading. */
  canUse(feature: GatedFeature): boolean;
  /** Whether the user can claim one more territory given their current count. */
  canClaimTerritory(currentOwnedCount: number): boolean;
  /** Same as canClaimTerritory but returns a human-readable reason when blocked. */
  territoryBlockReason(currentOwnedCount: number): string | null;
}

export function useFeatureGate(): FeatureGateResult {
  const { currentTier, loading } = useSubscription();
  const tier = currentTier ?? 'free';
  const plus = isPlus(tier);
  const territoryLimit = zoneLimitFor(tier);

  const canUse = (feature: GatedFeature): boolean => {
    const f = (LEGACY as Record<string, Feature>)[feature] ?? (feature as Feature);
    // Free features never wait on the tier; Plus ones stay locked until it loads.
    if (canUseFeature(f, 'free')) return true;
    if (loading) return false;
    return canUseFeature(f, tier);
  };

  const canClaimTerritory = (currentOwnedCount: number): boolean => {
    if (loading) return true;
    return canClaimZone(currentOwnedCount, tier);
  };

  const territoryBlockReason = (currentOwnedCount: number): string | null => {
    if (canClaimTerritory(currentOwnedCount)) return null;
    return `Free runners hold ${territoryLimit} zones at once. You hold ${currentOwnedCount}. Runivo Plus removes the limit.`;
  };

  return { isPremium: plus, territoryLimit, loading, canUse, canClaimTerritory, territoryBlockReason };
}
