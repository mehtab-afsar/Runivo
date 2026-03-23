import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@shared/services/supabase';
import {
  getAvailablePackages,
  purchaseProduct,
  restorePurchases,
  RC_PRODUCT_MONTHLY,
  RC_PRODUCT_ANNUAL,
} from '../services/purchaseService';

export function useSubscription() {
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [rcPrices, setRcPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
          setCurrentTier(data?.subscription_tier ?? 'free');
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

  const refreshTier = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
      setCurrentTier(data?.subscription_tier ?? 'runner-plus');
    }
  };

  const purchasePlan = useCallback(async (planId: string, rcProductId: string) => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const result = await purchaseProduct(rcProductId);
      if (result.cancelled) return;
      if (result.success) {
        await refreshTier();
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
        setCurrentTier('runner-plus');
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

  const isPremium = currentTier != null && currentTier !== 'free';

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
