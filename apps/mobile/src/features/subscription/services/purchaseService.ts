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

import { SUBSCRIPTIONS_ENABLED } from '@shared/engine/entitlements';
import { Platform } from 'react-native';
import { captureHandledError } from '@shared/services/errorReporting';

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
let _rcUserId: string | null = null;

/**
 * Detach this phone's RevenueCat identity from the signed-out user. Without it
 * a second account that signs in on the same phone inherits the first one's
 * app-user id, so its purchases (and the rc-webhook tier upgrade) land on the
 * wrong profile.
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!_rcReady) return;
  const Purchases = await getRC();
  try { await Purchases?.logOut(); } catch { /* anonymous already, or offline */ }
  _rcUserId = null;
}

async function getRC() {
  try {
    const { default: Purchases } = await import('react-native-purchases' as any);
    return Purchases;
  } catch {
    // react-native-purchases is not in this build (e.g. Expo Go); purchases are simply unavailable.
    return null;
  }
}

/**
 * Configure RevenueCat. Call once on app startup (after auth).
 * Safe to call multiple times — skips if already configured.
 */
export async function configureRevenueCat(userId?: string): Promise<void> {
  if (_rcReady) {
    // Already configured: only the identity may have changed (sign-out, then a
    // different account signs in).
    if (userId && userId !== _rcUserId) {
      const Purchases = await getRC();
      try { await Purchases?.logIn(userId); _rcUserId = userId; } catch (err) { captureHandledError(err, { domain: 'purchase', operation: 'revenuecat-login' }); /* retried on next call */ }
    }
    return;
  }
  // Subscriptions are off while testing: don't connect to the store at all.
  if (!SUBSCRIPTIONS_ENABLED) return;

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
      _rcUserId = userId;
    }
    _rcReady = true;
  } catch (err) {
    captureHandledError(err, { domain: 'purchase', operation: 'configure-revenue-cat' });
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
    captureHandledError(err, { domain: 'purchase', operation: 'get-available-packages' });
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
      // Not a thing to show a runner ("Product runivo_plus_annual not found in offerings"):
      // the store did not return this plan, so it cannot be bought right now.
      console.warn(`[purchase] ${productId} is not in the current offering`);
      return { success: false, error: "This plan isn't available right now. Please try again in a moment." };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isActive = !!customerInfo.entitlements.active['runivo_plus'];

    return { success: isActive, productId };
  } catch (err: any) {
    if (err?.userCancelled) return { success: false, cancelled: true };
    captureHandledError(err, { domain: 'purchase', operation: 'purchase-product' });
    return { success: false, error: err?.message ?? 'Purchase failed' };
  }
}

/**
 * Restore purchases (required for App Store Review compliance).
 * 'restored' = an active Plus entitlement came back; 'none' = the store answered and
 * there is nothing to restore; 'error' = we could not ask (offline, store down).
 * They used to be one `false`, so a dropped connection told a paying customer
 * "No purchases found".
 */
export type RestoreResult = 'restored' | 'none' | 'error';

export async function restorePurchases(): Promise<RestoreResult> {
  const Purchases = await getRC();
  if (!Purchases) return 'error';

  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['runivo_plus'] ? 'restored' : 'none';
  } catch (err) {
    captureHandledError(err, { domain: 'purchase', operation: 'restore-purchases' });
    return 'error';
  }
}

/**
 * Hear about renewals, expiry, refunds and purchases made on another device, so
 * the screen stops showing "Plus" the moment it ends instead of at the next launch.
 * Returns an unsubscribe function.
 */
export function onSubscriptionChange(cb: (active: boolean) => void): () => void {
  let remove: (() => void) | null = null;
  let cancelled = false;
  getRC().then(Purchases => {
    if (!Purchases || cancelled || !_rcReady) return;
    const listener = (info: { entitlements: { active: Record<string, unknown> } }) => cb(!!info.entitlements.active['runivo_plus']);
    Purchases.addCustomerInfoUpdateListener(listener);
    remove = () => { try { Purchases.removeCustomerInfoUpdateListener(listener); } catch { /* already gone */ } };
  }).catch(() => {});
  return () => { cancelled = true; remove?.(); };
}

/** Where a runner changes or cancels their subscription (Apple ID settings on iOS, Play on Android). */
export function manageSubscriptionUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
