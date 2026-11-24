/**
 * Consent to send run and fitness data to the third-party AI behind PaceX
 * (Anthropic). App Store Guideline 5.1.2(i) requires explicit permission first.
 *
 * Two copies of one fact, on purpose:
 *  - profiles.ai_consent_at on the server is the authority: the ai-coach edge
 *    function refuses without it (403 ai_consent_required), so a modified app
 *    cannot skip the prompt.
 *  - settings.aiConsentAt on the phone lets the app decide, without a network
 *    call, whether to show the consent screen or call the coach at all.
 */
import { getSettings, saveSettings } from './store';
import { supabase } from './supabase';

/** True when this runner has agreed. Falls back to the server for a fresh install or new device. */
export async function hasAiConsent(): Promise<boolean> {
  try {
    const settings = await getSettings();
    if (settings.aiConsentAt) return true;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data } = await supabase.from('profiles').select('ai_consent_at').eq('id', session.user.id).maybeSingle();
    const at = (data as { ai_consent_at: string | null } | null)?.ai_consent_at;
    if (!at) return false;

    await saveSettings({ ...settings, aiConsentAt: Date.parse(at) || Date.now() });
    return true;
  } catch {
    return false; // when in doubt, do not send personal data
  }
}

/**
 * The server's answer, ignoring the phone's copy: true/false, or null when it
 * can't be asked (offline, signed out). A phone copy the server doesn't share
 * (left by another account, or withdrawn on another device) is cleared.
 */
export async function verifyAiConsentWithServer(): Promise<boolean | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase.from('profiles').select('ai_consent_at').eq('id', session.user.id).maybeSingle();
    if (error) return null;
    const ok = !!(data as { ai_consent_at: string | null } | null)?.ai_consent_at;
    if (!ok) await forgetLocalAiConsent();
    return ok;
  } catch {
    // Offline: no server verdict, so callers fall back to the local record.
    return null;
  }
}

/** Drop the phone's copy of the consent (the server refused, or it isn't this account's). */
export async function forgetLocalAiConsent(): Promise<void> {
  const settings = await getSettings();
  if (settings.aiConsentAt) await saveSettings({ ...settings, aiConsentAt: null });
}

/**
 * Record agreeing (granted = true) or withdrawing. The server is written first:
 * granting only counts once the authority has it, otherwise the next AI call
 * would be refused after the screen said "on". Returns false on failure.
 */
export type AiConsentFailure = 'signed_out' | 'server_not_updated' | 'network' | null;
let lastFailure: AiConsentFailure = null;
/** Why the last setAiConsent call failed, so the screen can say something useful. */
export function lastAiConsentFailure(): AiConsentFailure { return lastFailure; }

export async function setAiConsent(granted: boolean): Promise<boolean> {
  lastFailure = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { lastFailure = 'signed_out'; return false; }
    const { error } = await supabase
      .from('profiles')
      .update({ ai_consent_at: granted ? new Date().toISOString() : null })
      .eq('id', session.user.id);
    if (error) {
      // 42703 / PGRST204: the ai_consent_at column isn't on the server yet
      // (migration 20261115000014 not pushed).
      const code = (error as { code?: string }).code ?? '';
      lastFailure = code === '42703' || code === 'PGRST204' || /ai_consent_at/.test(error.message ?? '') ? 'server_not_updated' : 'network';
      return false;
    }

    const settings = await getSettings();
    await saveSettings({ ...settings, aiConsentAt: granted ? Date.now() : null });
    return true;
  } catch {
    // When in doubt, report no consent so no personal data is sent.
    lastFailure = 'network';
    return false;
  }
}
