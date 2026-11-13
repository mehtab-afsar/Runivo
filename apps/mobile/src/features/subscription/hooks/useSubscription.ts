import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@shared/services/supabase';
import type { SubscriptionTier } from '../types';
import { isPlus } from '@shared/engine/entitlements';
import {
  getAvailablePackages,
  purchaseProduct,
  restorePurchases,
  RC_PRODUCT_MONTHLY,
  RC_PRODUCT_ANNUAL,
} from '../services/purchaseService';

export function useSubscription() {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [rcPrices, setRcPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
          setCurrentTier((data?.subscription_tier as SubscriptionTier | null) ?? 'free');
        }
        const packages = await getAvailablePackages();
        const prices: Record<string, string> = {};
        for (const pkg of packages) {
          prices[pkg.product.identifier] = pkg.product.priceString;
        }
        if (Object.keys(prices).length > 0) setRcPrices(prices);
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, []);

  // Re-reads the server's tier. Only used to RECONCILE after a purchase/restore
  // that already set an optimistic value locally — if the webhook hasn't landed
  // yet and this comes back null, keep whatever's already showing (which reflects
  // the client-confirmed entitlement) rather than falling back to a guess.
  const refreshTier = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
    if (data?.subscription_tier) setCurrentTier(data.subscription_tier as SubscriptionTier);
  };

  const purchasePlan = useCallback(async (_planId: string, rcProductId: string) => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const result = await purchaseProduct(rcProductId);
      if (result.cancelled) return;
      if (result.success) {
        // Optimistic: purchaseProduct already confirmed the 'runivo_plus'
        // entitlement is active client-side before returning success, so the
        // user is premium now even if profiles.subscription_tier hasn't been
        // updated yet (the RC webhook lands async, often a second or two later).
        setCurrentTier('premium');
        refreshTier().catch(() => {});
        Alert.alert('Welcome to Runivo Plus!', 'All premium features are now unlocked.');
      } else {
        Alert.alert('Purchase failed', result.error ?? 'Please try again.');
      }
    } catch {
      Alert.alert('Purchase failed', 'Please try again later.');
    } finally {
      setPurchasing(false);
    }
  }, [purchasing]);

  const restorePlan = useCallback(async () => {
    setPurchasing(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        setCurrentTier('premium');
        refreshTier().catch(() => {});
        Alert.alert('Purchases restored', 'Your subscription has been restored.');
      } else {
        Alert.alert('No purchases found', 'No active subscription was found for this account.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again later.');
    } finally {
      setPurchasing(false);
    }
  }, []);

  const isPremium = isPlus(currentTier);

  return {
    currentTier,
    isPremium,
    loading,
    purchasing,
    rcPrices,
    purchasePlan,
    restorePlan,
    RC_PRODUCT_MONTHLY,
    RC_PRODUCT_ANNUAL,
  };
}
