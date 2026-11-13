import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '@shared/services/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Social sign-in over PKCE (see `flowType: 'pkce'` in supabase.native.ts).
 *
 * The previous implementation ran the implicit flow: it read `access_token` and
 * `refresh_token` straight out of the returned URL fragment and handed them to
 * `setSession()` without checking where the URL came from. `runivo://` is a custom
 * scheme that any app on Android can also register, so that was a session-fixation
 * sink — a crafted callback could log the user into an attacker's account, or an
 * interceptor could lift a full session out of the fragment.
 *
 * Under PKCE the callback carries only a single-use `?code=`, useless without the
 * code_verifier this client generated and kept locally. The origin check below is
 * defence in depth: nothing but our own redirect target should ever be parsed.
 */
export const OAUTH_REDIRECT = (): string => makeRedirectUri({ scheme: 'runivo', path: 'auth/callback' });

/**
 * Opens a Supabase OAuth URL in the system auth session and finishes it:
 * checks the redirect origin, surfaces provider errors, exchanges the single-use
 * PKCE code. Shared by sign-in and by linking a provider to the signed-in user.
 * Returns false when the runner backed out.
 */
export async function completeOAuthInBrowser(url: string, redirectTo: string): Promise<boolean> {
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  // 'cancel' / 'dismiss' — user backed out; not an error.
  if (result.type !== 'success') return false;

  const returned = new URL(result.url);
  const expected = new URL(redirectTo);
  if (returned.protocol !== expected.protocol || returned.host !== expected.host) {
    throw new Error('OAuth redirect origin mismatch — sign-in rejected.');
  }

  // Supabase surfaces provider failures as query params rather than a rejected promise.
  const oauthError = returned.searchParams.get('error_description')
    ?? returned.searchParams.get('error');
  if (oauthError) throw new Error(oauthError);

  const code = returned.searchParams.get('code');
  if (!code) throw new Error('No authorization code returned');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}

async function oauthFlow(provider: 'google'): Promise<void> {
  const redirectTo = OAUTH_REDIRECT();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  await completeOAuthInBrowser(data.url, redirectTo);
}

export const signInWithGoogle = (): Promise<void> => oauthFlow('google');

/**
 * Native Apple credential with a nonce: the raw nonce stays here, only its
 * SHA-256 hash goes to Apple. Supabase re-hashes the raw nonce and compares it
 * with the hashed claim in Apple's identityToken, binding the token to this
 * attempt (replay/CSRF defence). Null when the runner backed out.
 */
export async function nativeAppleCredential(): Promise<{ token: string; nonce: string } | null> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err: any) {
    if (err?.code === 'ERR_REQUEST_CANCELED') return null; // user backed out — not an error
    throw err;
  }

  if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token');
  return { token: credential.identityToken, nonce: rawNonce };
}

/**
 * Sign in with Apple via the native AuthenticationServices flow — not the
 * generic OAuth browser popup `signInWithGoogle` uses. Apple's App Review
 * Guideline 4.8 / HIG require the native flow and the official Apple-rendered
 * button specifically. Android/web keep using the OAuth path — Apple only
 * requires the native flow on the native iOS app.
 */
export async function signInWithApple(): Promise<void> {
  const cred = await nativeAppleCredential();
  if (!cred) return;
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token:    cred.token,
    nonce:    cred.nonce,
  });
  if (error) throw error;
}
