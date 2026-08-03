import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
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
async function oauthFlow(provider: 'google' | 'apple'): Promise<void> {
  const redirectTo = makeRedirectUri({ scheme: 'runivo', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  // 'cancel' / 'dismiss' — user backed out; not an error.
  if (result.type !== 'success') return;

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
}

export const signInWithGoogle = (): Promise<void> => oauthFlow('google');
export const signInWithApple  = (): Promise<void> => oauthFlow('apple');
