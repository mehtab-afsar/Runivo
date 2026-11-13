/**
 * Linking sign-in methods to the signed-in account (Settings → Sign-in
 * methods). Needs "Allow manual linking" on in Supabase Auth settings.
 *
 * Google links through the same PKCE browser flow as sign-in; Apple links with
 * the native credential; a phone number is added with updateUser + a
 * phone_change code. Unlinking is refused by Supabase for the last identity,
 * and the app never offers it then (packages/shared/src/engine/identities.ts).
 */
import type { UserIdentity } from '@supabase/supabase-js';
import { supabase } from '@shared/services/supabase';
import { linkErrorMessage, linkedMethods, type LinkedMethod } from '@shared/engine/identities';
import { completeOAuthInBrowser, nativeAppleCredential, OAUTH_REDIRECT } from './socialAuth';

function fail(e: unknown): never {
  throw new Error(linkErrorMessage(e instanceof Error ? e.message : String(e)));
}

export async function loadSignInMethods(): Promise<LinkedMethod[]> {
  const [{ data: ids, error }, { data: { user } }] = await Promise.all([
    supabase.auth.getUserIdentities(),
    supabase.auth.getUser(),
  ]);
  if (error) fail(error);
  return linkedMethods(ids?.identities ?? [], { email: user?.email ?? null, phone: user?.phone ?? null });
}

/** Returns false if the runner backed out of the browser. */
export async function linkGoogle(): Promise<boolean> {
  try {
    const redirectTo = OAUTH_REDIRECT();
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('No link URL returned');
    return await completeOAuthInBrowser(data.url, redirectTo);
  } catch (e) {
    fail(e);
  }
}

/** iOS only. Returns false if the runner backed out. */
export async function linkApple(): Promise<boolean> {
  try {
    const cred = await nativeAppleCredential();
    if (!cred) return false;
    const { error } = await supabase.auth.linkIdentity({ provider: 'apple', token: cred.token, nonce: cred.nonce });
    if (error) throw error;
    return true;
  } catch (e) {
    fail(e);
  }
}

/** Sends a code to the new number. */
export async function sendAddPhoneCode(e164: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) fail(error);
}

export async function verifyAddPhoneCode(e164: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'phone_change' });
  if (error) fail(error);
}

export async function unlinkMethod(row: LinkedMethod): Promise<void> {
  if (!row.identity || !row.canUnlink) throw new Error('Keep at least one way to sign in.');
  const { error } = await supabase.auth.unlinkIdentity(row.identity as unknown as UserIdentity);
  if (error) fail(error);
}
