/**
 * purchaseService — RevenueCat in-app purchase wrapper.
 *
 * Wraps `react-native-purchases` (peer dependency).
 * If the package is not installed or the API key is missing, all functions
 * are silent no-ops that return safe defaults.
 *
 * Product identifiers match the RevenueCat entitlement/offering IDs:
 *   MONTHLY  → 'runivo_plus_monthly'
 *   ANNUAL   → 'runivo_plus_annual'
 *
 * Required env vars (set in app.config.ts → extra):
 *   EXPO_PUBLIC_RC_API_KEY_IOS     — RevenueCat iOS API key
 *   EXPO_PUBLIC_RC_API_KEY_ANDROID — RevenueCat Android API key
 *
 * On successful purchase, RevenueCat calls its webhook → Supabase function
 * `rc-webhook` updates `profiles.subscription_tier`. The app re-fetches
 * the profile to update local state.
 */

import { Platform } from 'react-native';

// Product IDs must match what's configured in App Store Connect / Google Play
// and in the RevenueCat dashboard.
export const RC_PRODUCT_MONTHLY = 'runivo_plus_monthly';
export const RC_PRODUCT_ANNUAL  = 'runivo_plus_annual';

// Offering identifier configured in RevenueCat dashboard
const RC_OFFERING = 'default';

type RCPackage = {
  identifier:  string;
  packageType: string;
  product: {
    identifier:     string;
    priceString:    string;
    currencyCode:   string;
    description:    string;
    title:          string;
    introPrice?:    { priceString: string; periodNumberOfUnits: number; periodUnit: string } | null;
  };
};

let _rcReady = false;

async function getRC() {
  try {
    const { default: Purchases } = await import('react-native-purchases' as any);
    return Purchases;
  } catch {
    return null;
  }
}

/**
 * Configure RevenueCat. Call once on app startup (after auth).
 * Safe to call multiple times — skips if already configured.
 */
export async function configureRevenueCat(userId?: string): Promise<void> {
  if (_rcReady) return;

  const Purchases = await getRC();
  if (!Purchases) return;

  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_RC_API_KEY_IOS
    : process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID;

  if (!apiKey) {
    console.warn('[purchase] RevenueCat API key not set');
    return;
  }

  try {
    Purchases.configure({ apiKey });
    if (userId) {
      await Purchases.logIn(userId);
    }
    _rcReady = true;
  } catch (err) {
    console.warn('[purchase] RevenueCat configure failed:', err);
  }
}

/**
 * Fetch available packages from the RevenueCat default offering.
 * Returns [] if unavailable.
 */
export async function getAvailablePackages(): Promise<RCPackage[]> {
  const Purchases = await getRC();
  if (!Purchases) return [];

  try {
    const offerings = await Purchases.getOfferings();
    const offering  = offerings.current ?? offerings.all[RC_OFFERING];
    return offering?.availablePackages ?? [];
  } catch (err) {
    console.warn('[purchase] getOfferings failed:', err);
    return [];
  }
}

export interface PurchaseResult {
  success:     boolean;
  productId?:  string;
  error?:      string;
  cancelled?:  boolean;
}

/**
 * Purchase a package by product identifier.
 * RevenueCat webhook handles subscription activation in Supabase.
 */
export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  const Purchases = await getRC();
  if (!Purchases) {
    return { success: false, error: 'RevenueCat not available' };
  }

  try {
    const packages = await getAvailablePackages();
    const pkg = packages.find(p => p.product.identifier === productId);
    if (!pkg) {
      return { success: false, error: `Product ${productId} not found in offerings` };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isActive = !!customerInfo.entitlements.active['runivo_plus'];

    return { success: isActive, productId };
  } catch (err: any) {
    if (err?.userCancelled) return { success: false, cancelled: true };
    console.warn('[purchase] purchasePackage failed:', err);
    return { success: false, error: err?.message ?? 'Purchase failed' };
  }
}

/**
 * Restore purchases (required for App Store Review compliance).
 * Returns true if an active entitlement was restored.
 */
export async function restorePurchases(): Promise<boolean> {
  const Purchases = await getRC();
  if (!Purchases) return false;

  try {
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active['runivo_plus'];
  } catch (err) {
    console.warn('[purchase] restorePurchases failed:', err);
    return false;
  }
}

/**
 * Check if the user currently has an active subscription via RevenueCat.
 * Prefer checking `profiles.subscription_tier` in Supabase for the
 * authoritative source; this is a client-side fallback.
 */
export async function hasActiveSubscription(): Promise<boolean> {
  const Purchases = await getRC();
  if (!Purchases) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active['runivo_plus'];
  } catch {
    return false;
  }
}
