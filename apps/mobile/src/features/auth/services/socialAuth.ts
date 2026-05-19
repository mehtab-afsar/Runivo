import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@shared/services/supabase';

WebBrowser.maybeCompleteAuthSession();

async function oauthFlow(provider: 'google' | 'apple'): Promise<void> {
  const redirectTo = makeRedirectUri({ scheme: 'runivo', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const hash = new URL(result.url).hash.slice(1);
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
}

export const signInWithGoogle = (): Promise<void> => oauthFlow('google');
export const signInWithApple  = (): Promise<void> => oauthFlow('apple');
