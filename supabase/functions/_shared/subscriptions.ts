/**
 * Subscriptions are switched off while Runivo is still being built: every
 * runner is treated as Plus. Set the SUBSCRIPTIONS_ENABLED secret to "true"
 * at launch (with app_settings.subscriptions_enabled and the app's
 * SUBSCRIPTIONS_ENABLED); the stored subscription_tier is never changed.
 */
export const SUBSCRIPTIONS_ENABLED = Deno.env.get('SUBSCRIPTIONS_ENABLED') === 'true';

/** The tier the game applies: the stored one, or Plus for all while subscriptions are off. */
export function effectiveTier(tier: string | null | undefined): string {
  return SUBSCRIPTIONS_ENABLED ? (tier ?? 'free') : 'premium';
}
